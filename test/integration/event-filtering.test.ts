/**
 * Integration Tests: Event Filtering
 *
 * Tests to verify internal events are not exposed to users.
 */

import { describe, expect, it } from "vitest";
import { createAgent, type AgentEvent } from "../../src";
import {
  createCapturingSTTProvider,
  createCapturingLLMProvider,
  createCapturingTTSProvider,
  tick,
  expectNoInternalEvents,
  expectEventExists,
} from "../helpers";

describe("event filtering", () => {
  it("does not expose internal events to onEvent callback", async () => {
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

    // Trigger activity that generates internal events
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    const llmCtx = llm.getCtx();
    llmCtx.token("Hi");
    llmCtx.sentence("Hi there!", 0);
    await tick();

    const ttsCtx = tts.getCtx();
    ttsCtx.audioChunk(new Float32Array([0.1, 0.2]));
    ttsCtx.complete();
    await tick();

    llmCtx.complete("Hi there!");
    await tick();

    // Verify no internal events leaked
    expectNoInternalEvents(events);

    agent.stop();
  });

  it("internal events start with underscore prefix", async () => {
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

    // Trigger various events
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Test", true);
    await tick();

    // All public event types should NOT start with underscore
    for (const event of events) {
      expect(event.type.startsWith("_")).toBe(false);
    }

    agent.stop();
  });

  it("exposes public agent lifecycle events", async () => {
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

    expectEventExists(events, "agent:started");

    agent.stop();
    await tick();

    expectEventExists(events, "agent:stopped");
  });

  it("exposes public human turn events", async () => {
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
    sttCtx.speechStart();
    sttCtx.transcript("Hello world", false);
    sttCtx.transcript("Hello world!", true);
    await tick();

    expectEventExists(events, "human-turn:started");
    expectEventExists(events, "human-turn:transcript");
    expectEventExists(events, "human-turn:ended");

    agent.stop();
  });

  it("exposes public AI turn events", async () => {
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

    // Trigger a full turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    const llmCtx = llm.getCtx();
    llmCtx.token("Hi");
    llmCtx.sentence("Hi there!", 0);
    await tick();

    const ttsCtx = tts.getCtx();
    ttsCtx.audioChunk(new Float32Array([0.1]));
    ttsCtx.complete();
    await tick();

    llmCtx.complete("Hi there!");
    await tick();

    expectEventExists(events, "ai-turn:started");
    expectEventExists(events, "ai-turn:token");
    expectEventExists(events, "ai-turn:sentence");
    expectEventExists(events, "ai-turn:audio");
    expectEventExists(events, "ai-turn:ended");

    agent.stop();
  });

  it("filters out _stt internal events", async () => {
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
    sttCtx.speechStart();
    sttCtx.transcript("Test", false);
    sttCtx.transcript("Test message", true);
    sttCtx.speechEnd();
    await tick();

    // These internal events should NOT appear
    const sttEvents = events.filter((e) => e.type.startsWith("_stt:"));
    expect(sttEvents.length).toBe(0);

    agent.stop();
  });

  it("filters out _llm internal events", async () => {
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
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    const llmCtx = llm.getCtx();
    llmCtx.token("Hi");
    llmCtx.sentence("Hi!", 0);
    llmCtx.complete("Hi!");
    await tick();

    // These internal events should NOT appear
    const llmEvents = events.filter((e) => e.type.startsWith("_llm:"));
    expect(llmEvents.length).toBe(0);

    agent.stop();
  });

  it("filters out _tts internal events", async () => {
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
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hi!", 0);
    await tick();

    const ttsCtx = tts.getCtx();
    ttsCtx.audioChunk(new Float32Array([0.1]));
    ttsCtx.complete();
    await tick();

    // These internal events should NOT appear
    const ttsEvents = events.filter((e) => e.type.startsWith("_tts:"));
    expect(ttsEvents.length).toBe(0);

    agent.stop();
  });
});
