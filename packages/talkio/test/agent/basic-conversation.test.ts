import { describe, expect, it } from "vitest";

import { createAgentHarness, drainMicrotasks } from "../helpers/harness";

function makeAudioChunk(value: number, size = 4): ArrayBuffer {
  return new Uint8Array(Array.from({ length: size }, () => value)).buffer;
}

describe("basic conversation", () => {
  it("runs a golden flow and emits the expected sequence", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;
    const reader = agent.audioStream.getReader();

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", false);
    stt.emitTranscript("hello", true);

    await events.waitForEvent("ai-turn:started");

    llm.emitToken("Hi");
    llm.emitSentence("Hi there.", 0);

    const audioChunk = makeAudioChunk(7);
    const audioRead = reader.read();
    tts.emitAudio(audioChunk);
    const readResult = await audioRead;

    llm.complete("Hi there.");
    tts.complete();

    const aiEnded = await events.waitForEvent("ai-turn:ended");
    expect(aiEnded.wasSpoken).toBe(true);

    const state = agent.getSnapshot();
    expect(state.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "Hi there." },
    ]);

    expect(readResult.done).toBe(false);
    expect(new Uint8Array(readResult.value ?? new ArrayBuffer(0))).toEqual(
      new Uint8Array(audioChunk),
    );

    agent.stop();
    await events.waitForEvent("agent:stopped");

    events.assertSequence([
      "agent:started",
      "human-turn:started",
      "human-turn:transcript",
      "human-turn:transcript",
      "human-turn:ended",
      "ai-turn:started",
      "ai-turn:token",
      "ai-turn:sentence",
      "ai-turn:audio",
      "ai-turn:ended",
      "agent:stopped",
    ]);
  });

  it("maintains invariant ordering for public events", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hi", false);
    stt.emitTranscript("hi", true);

    await events.waitForEvent("ai-turn:started");
    llm.emitSentence("Hello.", 0);
    tts.emitAudio(makeAudioChunk(5));
    llm.complete("Hello.");
    tts.complete();

    await events.waitForEvent("ai-turn:ended");

    agent.stop();
    await events.waitForEvent("agent:stopped");

    await drainMicrotasks();

    events.assertInvariants();
  });
});
