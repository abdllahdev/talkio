import { describe, expect, it, vi } from "vitest";

import { createAgentHarness } from "../helpers/harness";

function makeAudioChunk(value: number): ArrayBuffer {
  return new Uint8Array([value, value, value]).buffer;
}

describe("metrics", () => {
  it("tracks latency and counts for a completed turn", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    vi.setSystemTime(100);
    stt.emitTranscript("hello", false);

    vi.setSystemTime(200);
    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    vi.setSystemTime(260);
    llm.emitToken("Hi");

    vi.setSystemTime(300);
    llm.emitSentence("Hi.", 0);

    vi.setSystemTime(350);
    tts.emitAudio(makeAudioChunk(3));

    vi.setSystemTime(400);
    llm.complete("Hi.");

    vi.setSystemTime(500);
    tts.complete();

    const aiEnded = await events.waitForEvent("ai-turn:ended");
    expect(aiEnded.metrics.timeToFirstToken).toBe(60);
    expect(aiEnded.metrics.timeToFirstSentence).toBe(40);
    expect(aiEnded.metrics.timeToFirstAudio).toBe(50);
    expect(aiEnded.metrics.totalDuration).toBe(300);
    expect(aiEnded.metrics.tokenCount).toBe(1);
    expect(aiEnded.metrics.sentenceCount).toBe(1);

    const snapshot = agent.getSnapshot();
    expect(snapshot.metrics.turns.total).toBe(1);
    expect(snapshot.metrics.turns.completed).toBe(1);
    expect(snapshot.metrics.content.totalResponseChars).toBe("Hi.".length);
    expect(snapshot.metrics.audio.totalAudioChunks).toBe(1);

    agent.stop();
    await events.waitForEvent("agent:stopped");

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("tracks interrupted and error counts", async () => {
    const harness = createAgentHarness({ useVAD: true, interruption: { enabled: true } });
    const { agent, events, stt, llm, vad, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Hello.", 0);
    tts.emitAudio(makeAudioChunk(4));
    vad?.emitSpeechStart();

    await events.waitForEvent("ai-turn:interrupted");

    stt.emitError(new Error("stt issue"));
    await events.waitForEvent("agent:error");

    const snapshot = agent.getSnapshot();
    expect(snapshot.metrics.turns.interrupted).toBeGreaterThanOrEqual(1);
    expect(snapshot.metrics.errors.total).toBeGreaterThanOrEqual(1);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });
});
