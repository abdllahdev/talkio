import { describe, expect, it } from "vitest";

import { createAgentHarness, drainMicrotasks } from "../helpers/harness";

function makeAudioChunk(value: number): ArrayBuffer {
  return new Uint8Array([value]).buffer;
}

describe("turn detection", () => {
  it("uses STT final transcript when no turn detector is configured", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    const ended = await events.waitForEvent("human-turn:ended");
    expect(ended.transcript).toBe("hello");

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("waits for turn detector before ending a turn", async () => {
    const harness = createAgentHarness({ useTurnDetector: true });
    const { agent, events, stt, turnDetector, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", false);
    stt.emitTranscript("hello", true);

    await drainMicrotasks();
    expect(events.byType("human-turn:ended").length).toBe(0);

    turnDetector?.emitTurnEnd("hello there");
    const ended = await events.waitForEvent("human-turn:ended");
    expect(ended.transcript).toBe("hello there");

    await events.waitForEvent("ai-turn:started");
    llm.emitSentence("Hi.", 0);
    tts.emitAudio(makeAudioChunk(1));
    llm.complete("Hi.");
    tts.complete();
    await events.waitForEvent("ai-turn:ended");

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("does not end the turn on brief pauses without detector signal", async () => {
    const harness = createAgentHarness({ useTurnDetector: true });
    const { agent, events, stt } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", false);
    stt.emitTranscript("hello", true);
    stt.emitSpeechEnd();

    await drainMicrotasks();
    expect(events.byType("human-turn:ended").length).toBe(0);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });
});
