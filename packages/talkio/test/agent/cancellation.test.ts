import { describe, expect, it } from "vitest";

import { createAgentHarness } from "../helpers/harness";

describe("cancellation", () => {
  it("aborts providers when stopped while listening", async () => {
    const harness = createAgentHarness({ useVAD: true, useTurnDetector: true });
    const { agent, events, stt, vad, turnDetector } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    agent.stop();
    await events.waitForEvent("agent:stopped");

    expect(stt.aborted).toBe(true);
    expect(vad?.aborted).toBe(true);
    expect(turnDetector?.aborted).toBe(true);
  });

  it("aborts LLM when stopped during generation", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    agent.stop();
    await events.waitForEvent("agent:stopped");

    expect(llm.aborted).toBe(true);
  });

  it("aborts TTS when stopped during synthesis", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Hello.", 0);

    agent.stop();
    await events.waitForEvent("agent:stopped");

    expect(tts.abortedIds.length).toBeGreaterThan(0);
  });

  it("aborts streaming audio when stopped", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Hello.", 0);
    tts.emitAudio(new Uint8Array([1, 2]).buffer);

    agent.stop();
    await events.waitForEvent("agent:stopped");

    expect(tts.abortedIds.length).toBeGreaterThan(0);
  });
});
