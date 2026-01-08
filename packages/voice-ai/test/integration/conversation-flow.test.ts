/**
 * Integration Tests: Conversation Flow
 *
 * Tests for full conversation turn orchestration:
 * User speaks → STT transcribes → Turn ends → LLM generates → TTS synthesizes → Audio output
 */

import { describe, expect, it } from "vitest";
import { createAgent, type AgentEvent } from "../../src";
import {
  createCapturingSTTProvider,
  createCapturingLLMProvider,
  createCapturingTTSProvider,
  tick,
  createAudioChunk,
  expectEventExists,
  expectEventSequence,
  findEvents,
} from "../helpers";

describe("conversation flow", () => {
  it("orchestrates a complete conversation turn", async () => {
    const events: AgentEvent[] = [];
    const audioChunks: ArrayBuffer[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      onEvent: (event) => {
        events.push(event);
        if (event.type === "ai-turn:audio") {
          audioChunks.push(event.audio);
        }
      },
    });

    agent.start();
    await tick();

    // Verify agent:started event
    expectEventExists(events, "agent:started");

    // ─── STEP 1: User speaks → STT transcribes ───
    const sttCtx = stt.getCtx();

    // Verify audioFormat is passed to STT (uses provider's default when not specified)
    expect(sttCtx.audioFormat).toEqual(stt.provider.metadata.defaultInputFormat);

    // User starts speaking
    sttCtx.speechStart();
    expectEventExists(events, "human-turn:started");

    // STT streams partial transcripts
    sttCtx.transcript("What's the", false);
    sttCtx.transcript("What's the weather", false);

    // Verify partial transcripts are emitted
    const partialEvents = findEvents(events, "human-turn:transcript").filter((e) => !e.isFinal);
    expect(partialEvents.length).toBeGreaterThanOrEqual(2);

    // STT produces final transcript → triggers turn end → triggers LLM
    sttCtx.transcript("What's the weather today?", true);
    await tick();

    // Verify turn ended and response started
    expectEventExists(events, "human-turn:ended");
    expectEventExists(events, "ai-turn:started");

    // Verify user message added to history
    let snapshot = agent.getSnapshot();
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).toEqual({
      role: "user",
      content: "What's the weather today?",
    });

    // ─── STEP 2: LLM generates response ───
    const llmCtx = llm.getCtx();

    // Verify LLM received the conversation
    expect(llm.getMessages()).toHaveLength(1);
    expect(llm.getMessages()[0].content).toBe("What's the weather today?");

    // LLM streams tokens
    llmCtx.token("The ");
    llmCtx.token("weather ");
    llmCtx.token("is ");
    llmCtx.token("sunny ");
    llmCtx.token("today.");

    // Verify tokens are captured
    const tokenEvents = findEvents(events, "ai-turn:token");
    expect(tokenEvents.length).toBe(5);

    // LLM emits complete sentence → triggers TTS
    llmCtx.sentence("The weather is sunny today.", 0);
    await tick();

    // Verify sentence event
    expectEventExists(events, "ai-turn:sentence");
    snapshot = agent.getSnapshot();
    expect(snapshot.isSpeaking).toBe(true);

    // ─── STEP 3: TTS synthesizes the sentence ───
    const ttsCtx = tts.getCtx();

    // Verify TTS received the sentence and audioFormat (uses provider's default when not specified)
    expect(tts.getLastText()).toBe("The weather is sunny today.");
    expect(ttsCtx.audioFormat).toEqual(tts.provider.metadata.defaultOutputFormat);

    // TTS produces audio chunks
    const audioChunk1 = createAudioChunk();
    const audioChunk2 = createAudioChunk();
    ttsCtx.audioChunk(audioChunk1);
    ttsCtx.audioChunk(audioChunk2);
    await tick();

    // Verify audio chunks were emitted as events
    expect(audioChunks).toHaveLength(2);
    expect(audioChunks[0]).toEqual(audioChunk1);
    expect(audioChunks[1]).toEqual(audioChunk2);

    // TTS completes
    ttsCtx.complete();
    await tick();

    // ─── STEP 4: LLM completes generation ───
    llmCtx.complete("The weather is sunny today.");
    await tick();

    // Verify ai-turn:ended event
    expectEventExists(events, "ai-turn:ended");

    // Verify assistant message added to history
    snapshot = agent.getSnapshot();
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.messages[1]).toEqual({
      role: "assistant",
      content: "The weather is sunny today.",
    });

    // Speaking should be false after TTS completes
    expect(snapshot.isSpeaking).toBe(false);

    agent.stop();
  });

  it("emits events in correct sequence", async () => {
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
    llmCtx.sentence("Hi there!", 0);
    await tick();

    const ttsCtx = tts.getCtx();
    ttsCtx.audioChunk(createAudioChunk());
    ttsCtx.complete();
    await tick();

    llmCtx.complete("Hi there!");
    await tick();

    // Verify expected event sequence
    expectEventSequence(events, [
      "agent:started",
      "human-turn:started",
      "human-turn:transcript",
      "human-turn:ended",
      "ai-turn:started",
      "ai-turn:sentence",
      "ai-turn:audio",
      "ai-turn:ended",
    ]);

    agent.stop();
  });

  it("handles multiple sentences in one response", async () => {
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

    // User speaks
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Tell me about the weather", true);
    await tick();

    // LLM streams multiple sentences
    const llmCtx = llm.getCtx();
    llmCtx.sentence("The weather is sunny.", 0);
    await tick();

    // First TTS completes
    let ttsCtx = tts.getCtx();
    ttsCtx.audioChunk(createAudioChunk());
    ttsCtx.complete();
    await tick();

    // Second sentence
    llmCtx.sentence("Temperature is 72 degrees.", 1);
    await tick();

    // Second TTS completes
    ttsCtx = tts.getCtx();
    ttsCtx.audioChunk(createAudioChunk());
    ttsCtx.complete();
    await tick();

    // LLM completes
    llmCtx.complete("The weather is sunny. Temperature is 72 degrees.");
    await tick();

    // Verify both sentences were processed
    const sentenceEvents = findEvents(events, "ai-turn:sentence");
    expect(sentenceEvents.length).toBe(2);
    expect(sentenceEvents[0].sentence).toBe("The weather is sunny.");
    expect(sentenceEvents[1].sentence).toBe("Temperature is 72 degrees.");

    agent.stop();
  });
});
