/**
 * Integration Tests: Filler Phrases
 *
 * Tests for filler phrase support via ctx.say() and ctx.interrupt().
 * When LLM is slow, providers can use fillers to maintain conversation flow.
 */

import { describe, expect, it } from "vitest";
import { createAgent, type AgentEvent } from "../../src";
import {
  createCapturingSTTProvider,
  createCapturingLLMProvider,
  createCapturingTTSProvider,
  tick,
} from "../helpers";

describe("filler phrases", () => {
  it("supports filler phrases via ctx.say()", async () => {
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
    sttCtx.transcript("Tell me a story", true);
    await tick();

    // LLM uses ctx.say() to trigger a filler
    const llmCtx = llm.getCtx();
    llmCtx.say("Let me think about that...");
    await tick();

    // Verify TTS was triggered for filler
    expect(tts.getLastText()).toBe("Let me think about that...");

    // Verify speaking state
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    agent.stop();
  });

  it("supports ctx.interrupt() to stop filler playback", async () => {
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
    sttCtx.transcript("Tell me a story", true);
    await tick();

    // LLM uses ctx.say() to trigger a filler
    const llmCtx = llm.getCtx();
    llmCtx.say("Let me think about that...");
    await tick();

    // Verify speaking state
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    // LLM uses ctx.interrupt() to stop the filler
    llmCtx.interrupt();
    await tick();

    // Verify speaking stopped
    expect(agent.getSnapshot().isSpeaking).toBe(false);

    agent.stop();
  });

  it("filler events are internal (not exposed to users)", async () => {
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

    // Use filler
    const llmCtx = llm.getCtx();
    llmCtx.say("Um...");
    await tick();

    // Verify no internal _filler events are exposed
    const fillerEvents = events.filter(
      (e) => e.type.startsWith("_filler") || e.type.includes("filler"),
    );
    expect(fillerEvents.length).toBe(0);

    agent.stop();
  });

  it("ctx.isSpeaking() returns correct state", async () => {
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

    const llmCtx = llm.getCtx();

    // Initially not speaking
    expect(llmCtx.isSpeaking()).toBe(false);

    // Start speaking via filler
    llmCtx.say("Um...");
    await tick();

    // Now should be speaking
    expect(llmCtx.isSpeaking()).toBe(true);

    // Stop speaking
    llmCtx.interrupt();
    await tick();

    // No longer speaking
    expect(llmCtx.isSpeaking()).toBe(false);

    agent.stop();
  });

  it("main response can interrupt filler", async () => {
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
    sttCtx.transcript("Tell me a story", true);
    await tick();

    const llmCtx = llm.getCtx();

    // Start filler
    llmCtx.say("Let me think...");
    await tick();

    expect(agent.getSnapshot().isSpeaking).toBe(true);

    // Main response arrives, interrupt filler
    llmCtx.interrupt();
    await tick();

    // Now send the real response
    llmCtx.sentence("Once upon a time, there was a castle.", 0);
    await tick();

    // TTS should now have the main response
    expect(tts.getLastText()).toBe("Once upon a time, there was a castle.");

    agent.stop();
  });
});
