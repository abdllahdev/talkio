/**
 * Integration Tests: Error Handling
 *
 * Tests for error propagation from providers to the agent.
 */

import { describe, expect, it } from "vitest";

import { createAgent, type AgentEvent } from "../../src";
import {
  createCapturingSTTProvider,
  createCapturingLLMProvider,
  createCapturingTTSProvider,
  tick,
  findEvent,
} from "../helpers";

describe("error handling", () => {
  it("emits agent:error event from STT errors", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: createCapturingTTSProvider().provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Simulate STT error
    const sttCtx = stt.getCtx();
    sttCtx.error(new Error("STT connection lost"));
    await tick();

    // Verify error event
    const errorEvent = findEvent(events, "agent:error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.error.message).toBe("STT connection lost");
    expect(errorEvent?.source).toBe("stt");

    agent.stop();
  });

  it("emits agent:error event from LLM errors", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Trigger a turn to get LLM context
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    // Simulate LLM error
    const llmCtx = llm.getCtx();
    llmCtx.error(new Error("API rate limit exceeded"));
    await tick();

    // Verify error event
    const errorEvent = findEvent(events, "agent:error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.error.message).toBe("API rate limit exceeded");
    expect(errorEvent?.source).toBe("llm");

    agent.stop();
  });

  it("emits agent:error event from TTS errors", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Trigger a turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    // LLM sends sentence, triggering TTS
    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hi there!", 0);
    await tick();

    // Simulate TTS error
    const ttsCtx = tts.getCtx();
    ttsCtx.error(new Error("Voice synthesis failed"));
    await tick();

    // Verify error event
    const errorEvent = findEvent(events, "agent:error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.error.message).toBe("Voice synthesis failed");
    expect(errorEvent?.source).toBe("tts");

    agent.stop();
  });

  it("includes error source in the event", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: createCapturingLLMProvider().provider,
      tts: createCapturingTTSProvider().provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Simulate STT error
    const sttCtx = stt.getCtx();
    sttCtx.error(new Error("Test error"));
    await tick();

    const errorEvent = findEvent(events, "agent:error");
    expect(errorEvent?.source).toBe("stt");

    agent.stop();
  });

  it("agent continues operating after non-fatal errors", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    const sttCtx = stt.getCtx();

    // First turn with error
    sttCtx.speechStart();
    sttCtx.transcript("First question", true);
    await tick();

    const llmCtx = llm.getCtx();
    llmCtx.error(new Error("Temporary error"));
    await tick();

    // Agent should still be running
    expect(agent.getSnapshot().isRunning).toBe(true);

    // Should be able to process another turn
    sttCtx.speechStart();
    sttCtx.transcript("Second question", true);
    await tick();

    // Verify new turn started
    const humanTurnStartedCount = events.filter((e) => e.type === "human-turn:started").length;
    expect(humanTurnStartedCount).toBe(2);

    agent.stop();
  });

  it("handles multiple errors gracefully", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: createCapturingLLMProvider().provider,
      tts: createCapturingTTSProvider().provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    const sttCtx = stt.getCtx();

    // Multiple errors in sequence
    sttCtx.error(new Error("Error 1"));
    await tick();
    sttCtx.error(new Error("Error 2"));
    await tick();
    sttCtx.error(new Error("Error 3"));
    await tick();

    // All errors should be captured
    const errorEvents = events.filter((e) => e.type === "agent:error");
    expect(errorEvents.length).toBe(3);

    agent.stop();
  });
});
