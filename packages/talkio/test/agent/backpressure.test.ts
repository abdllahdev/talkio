import { describe, expect, it } from "vitest";

import { createAgentHarness } from "../helpers/harness";

function makeAudioChunk(value: number): ArrayBuffer {
  return new Uint8Array([value, value]).buffer;
}

describe("backpressure", () => {
  it("handles slow audio consumers without crashing", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Hello.", 0);

    tts.emitAudio(makeAudioChunk(1));
    tts.emitAudio(makeAudioChunk(2));
    tts.emitAudio(makeAudioChunk(3));

    llm.complete("Hello.");
    tts.complete();

    await events.waitForEvent("ai-turn:ended");

    const audioEvents = events.byType("ai-turn:audio");
    expect(audioEvents.length).toBe(3);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });
});
