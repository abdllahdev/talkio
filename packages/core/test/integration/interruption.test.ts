/**
 * Integration Tests: Interruption
 *
 * Tests for user interruption handling when the agent is speaking.
 */

import { describe, expect, it } from "vitest";

import { createAgent, type AgentEvent } from "../../src";
import {
  createCapturingLLMProvider,
  createCapturingSTTProvider,
  createCapturingTTSProvider,
  createCapturingVADProvider,
  expectEventExists,
  tick,
} from "../helpers";

describe("interruption handling", () => {
  it("handles interruption when user interrupts agent (STT fallback)", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      interruption: {
        enabled: true,
        minDurationMs: 50, // Low threshold for testing
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Start a conversation turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    // Agent starts generating response
    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hello! How can I help you today?", 0);
    await tick();

    // Verify agent is speaking
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    // User interrupts! (STT fallback requires speech start + transcript after minDuration)
    sttCtx.speechStart();
    await new Promise((resolve) => setTimeout(resolve, 60)); // Wait past minDurationMs
    sttCtx.transcript("Wait", false); // Interim transcript triggers interruption check
    await tick();

    // Verify interruption was detected
    expectEventExists(events, "ai-turn:interrupted");

    // Agent should have stopped speaking
    expect(agent.getSnapshot().isSpeaking).toBe(false);

    // AbortSignal should have been aborted (cancellation via signal)
    expect(llm.getCtx().signal.aborted).toBe(true);

    agent.stop();
  });

  it("handles interruption with VAD provider", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();
    const vad = createCapturingVADProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      vad: vad.provider,
      interruption: {
        enabled: true,
        minDurationMs: 50,
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Start a conversation turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    // Agent starts generating response
    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hello! How can I help you today?", 0);
    await tick();

    // Verify agent is speaking
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    // User interrupts via VAD
    const vadCtx = vad.getCtx();
    vadCtx.speechStart();
    await tick();

    // Verify interruption was detected
    expectEventExists(events, "ai-turn:interrupted");

    // Agent should have stopped speaking
    expect(agent.getSnapshot().isSpeaking).toBe(false);

    agent.stop();
  });

  it("does not interrupt when interruption is disabled", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      interruption: {
        enabled: false,
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Start a conversation turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    // Agent starts generating response
    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hello! How can I help you today?", 0);
    await tick();

    // Verify agent is speaking
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    // User tries to interrupt
    sttCtx.speechStart();
    await tick();

    // Should NOT have interrupted
    const interruptedEvents = events.filter((e) => e.type === "ai-turn:interrupted");
    expect(interruptedEvents.length).toBe(0);

    // Agent should still be speaking
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    agent.stop();
  });

  it("cancels TTS when interruption occurs", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      interruption: {
        enabled: true,
        minDurationMs: 50,
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // Start a conversation turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Tell me a story", true);
    await tick();

    // Agent starts generating response
    const llmCtx = llm.getCtx();
    llmCtx.sentence("Once upon a time...", 0);
    await tick();

    // User interrupts (STT fallback requires speech start + transcript after minDuration)
    sttCtx.speechStart();
    await new Promise((resolve) => setTimeout(resolve, 60)); // Wait past minDurationMs
    sttCtx.transcript("Stop", false); // Interim transcript triggers interruption check
    await tick();

    // AbortSignal should have been aborted
    expect(tts.getCtx().signal.aborted).toBe(true);

    agent.stop();
  });

  it("returns to listening state after interruption", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      interruption: {
        enabled: true,
        minDurationMs: 50,
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    // First turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await tick();

    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hello!", 0);
    await tick();

    // Interruption (STT fallback requires speech start + transcript after minDuration)
    sttCtx.speechStart();
    await new Promise((resolve) => setTimeout(resolve, 60)); // Wait past minDurationMs
    sttCtx.transcript("Wait", false); // Interim transcript triggers interruption
    await tick();

    // Verify we're back to listening (can process new transcript)
    sttCtx.transcript("Actually, tell me the weather", true);
    await tick();

    // Should have started a new AI turn
    const aiTurnStartedCount = events.filter((e) => e.type === "ai-turn:started").length;
    expect(aiTurnStartedCount).toBe(2);

    agent.stop();
  });
});
