import { describe, expect, it, vi } from "vitest";

import { createAgentHarness, drainMicrotasks } from "../helpers/harness";

function makeAudioChunk(value: number, size = 2): ArrayBuffer {
  return new Uint8Array(Array.from({ length: size }, () => value)).buffer;
}

describe("interruptions", () => {
  it("interrupts mid-response via VAD", async () => {
    const harness = createAgentHarness({
      useVAD: true,
      interruption: { enabled: true, minDurationMs: 200 },
    });
    const { agent, events, stt, llm, tts, vad } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Hello.", 0);
    tts.emitAudio(makeAudioChunk(1));

    vad?.emitSpeechStart();

    const interrupted = await events.waitForEvent("ai-turn:interrupted");
    expect(interrupted.partialText).toBe("");

    const humanStarted = await events.waitForEvent("human-turn:started");
    expect(humanStarted.type).toBe("human-turn:started");

    await drainMicrotasks();
    expect(tts.abortedIds.length).toBeGreaterThan(0);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("interrupts filler speech via VAD", async () => {
    const harness = createAgentHarness({
      useVAD: true,
      interruption: { enabled: true, minDurationMs: 200 },
    });
    const { agent, events, stt, llm, vad, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.say("Hmm...");
    await drainMicrotasks();

    vad?.emitSpeechStart();

    await events.waitForEvent("ai-turn:interrupted");
    expect(tts.abortedIds.length).toBeGreaterThan(0);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("does not interrupt for short STT speech below threshold", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const harness = createAgentHarness({
      interruption: { enabled: true, minDurationMs: 200 },
    });
    const { agent, events, stt, llm } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Hello.", 0);

    vi.setSystemTime(0);
    stt.emitSpeechStart();

    vi.setSystemTime(100);
    stt.emitTranscript("uh", false);

    expect(events.byType("ai-turn:interrupted").length).toBe(0);

    agent.stop();
    await events.waitForEvent("agent:stopped");

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("interrupts for STT speech after threshold", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const harness = createAgentHarness({
      interruption: { enabled: true, minDurationMs: 200 },
    });
    const { agent, events, stt, llm } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Hello.", 0);

    vi.setSystemTime(0);
    stt.emitSpeechStart();

    vi.setSystemTime(250);
    stt.emitTranscript("interrupt", false);

    await events.waitForEvent("ai-turn:interrupted");

    agent.stop();
    await events.waitForEvent("agent:stopped");

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
