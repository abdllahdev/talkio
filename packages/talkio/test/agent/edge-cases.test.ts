import { describe, expect, it } from "vitest";

import { createAgentHarness, drainMicrotasks } from "../helpers/harness";

describe("edge cases", () => {
  it("ignores sendAudio before start", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt } = harness;

    agent.sendAudio(new Uint8Array([1, 2, 3]));
    agent.start();

    await events.waitForEvent("agent:started");
    await drainMicrotasks();

    expect(stt.receivedAudio.length).toBe(0);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("treats start as idempotent", async () => {
    const harness = createAgentHarness();
    const { agent, events } = harness;

    agent.start();
    await events.waitForEvent("agent:started");
    agent.start();

    expect(events.byType("agent:started").length).toBe(1);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("treats stop as idempotent", async () => {
    const harness = createAgentHarness();
    const { agent, events } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    agent.stop();
    await events.waitForEvent("agent:stopped");
    agent.stop();

    expect(events.byType("agent:stopped").length).toBe(1);
  });

  it("handles empty transcripts", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("", true);
    const ended = await events.waitForEvent("human-turn:ended");
    expect(ended.transcript).toBe("");

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("processes long multi-sentence responses", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("hello", true);
    await events.waitForEvent("ai-turn:started");

    const sentences = ["One.", "Two.", "Three.", "Four.", "Five."];
    sentences.forEach((sentence, index) => {
      llm.emitSentence(sentence, index);
    });

    for (const sentence of sentences) {
      const current = tts.getCurrentRequest();
      expect(current?.text).toBe(sentence);
      tts.emitAudio(new Uint8Array([sentence.length]).buffer);
      tts.complete();
    }

    llm.complete(sentences.join(" "));
    await events.waitForEvent("ai-turn:ended");

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("handles rapid sequential user inputs", async () => {
    const harness = createAgentHarness();
    const { agent, events, stt, llm, tts } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    stt.emitTranscript("first", true);
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("First response.", 0);
    tts.emitAudio(new Uint8Array([1]).buffer);

    stt.emitTranscript("second", true);

    await events.waitForEvent("ai-turn:interrupted");
    await events.waitForEvent("ai-turn:started");

    llm.emitSentence("Second response.", 0);
    tts.emitAudio(new Uint8Array([2]).buffer);
    llm.complete("Second response.");
    tts.complete();

    await events.waitForEvent("ai-turn:ended");

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });
});
