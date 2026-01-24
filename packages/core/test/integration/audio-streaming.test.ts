/**
 * Integration Tests: Audio Streaming
 *
 * Tests for audio input routing and audio output streaming.
 */

import { describe, expect, it } from "vitest";

import { createAgent, type AgentEvent, type AudioFormat } from "../../src";
import {
  createAudioChunk,
  createCapturingLLMProvider,
  createCapturingSTTProvider,
  createCapturingTTSProvider,
  findEvents,
  mockLLMProvider,
  mockTTSProvider,
  tick,
} from "../helpers";

describe("audio streaming", () => {
  describe("audio input routing", () => {
    it("routes audio input to STT provider", async () => {
      const stt = createCapturingSTTProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      agent.start();
      await tick();

      // Send audio chunks from microphone
      const chunk1 = createAudioChunk();
      const chunk2 = createAudioChunk();
      const chunk3 = createAudioChunk();

      agent.sendAudio(chunk1);
      agent.sendAudio(chunk2);
      agent.sendAudio(chunk3);

      // Verify all chunks were forwarded to STT
      expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(3);
      expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(1, chunk1);
      expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(2, chunk2);
      expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(3, chunk3);

      agent.stop();
    });

    it("handles large number of audio chunks", async () => {
      const stt = createCapturingSTTProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      agent.start();
      await tick();

      // Send many audio chunks
      const chunkCount = 100;
      for (let i = 0; i < chunkCount; i++) {
        agent.sendAudio(createAudioChunk());
      }

      expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(chunkCount);

      agent.stop();
    });
  });

  describe("audio output stream", () => {
    it("exposes audioStream as ReadableStream", () => {
      const agent = createAgent({
        stt: createCapturingSTTProvider().provider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      expect(agent.audioStream).toBeInstanceOf(ReadableStream);
    });

    it("emits ai-turn:audio events for TTS chunks", async () => {
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

      // Trigger a conversation turn
      const sttCtx = stt.getCtx();
      sttCtx.speechStart();
      sttCtx.transcript("Hello", true);
      await tick();

      // LLM generates response
      const llmCtx = llm.getCtx();
      llmCtx.sentence("Hi there!", 0);
      await tick();

      // TTS produces audio
      const ttsCtx = tts.getCtx();
      const audioChunk1 = createAudioChunk();
      const audioChunk2 = createAudioChunk();
      ttsCtx.audioChunk(audioChunk1);
      ttsCtx.audioChunk(audioChunk2);
      await tick();

      // Verify audio events
      const audioEvents = findEvents(events, "ai-turn:audio");
      expect(audioEvents.length).toBe(2);
      expect(audioEvents[0].audio).toEqual(audioChunk1);
      expect(audioEvents[1].audio).toEqual(audioChunk2);

      agent.stop();
    });

    it("audio chunks are ArrayBuffers", async () => {
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
      ttsCtx.audioChunk(createAudioChunk());
      await tick();

      const audioEvents = findEvents(events, "ai-turn:audio");
      expect(audioEvents[0].audio).toBeInstanceOf(ArrayBuffer);

      agent.stop();
    });
  });

  describe("audio format", () => {
    it("passes input audio format to STT provider", async () => {
      const stt = createCapturingSTTProvider();

      const inputFormat = {
        sampleRate: 16000,
        channels: 1,
        encoding: "linear16",
      } satisfies AudioFormat;

      const outputFormat = {
        sampleRate: 24000,
        channels: 1,
        encoding: "linear16",
      } satisfies AudioFormat;

      const agent = createAgent({
        stt: stt.provider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
        audio: { input: inputFormat, output: outputFormat },
      });

      agent.start();
      await tick();

      const ctx = stt.getCtx();
      expect(ctx.audioFormat).toEqual(inputFormat);

      agent.stop();
    });

    it("passes output audio format to TTS provider", async () => {
      const stt = createCapturingSTTProvider();
      const llm = createCapturingLLMProvider();
      const tts = createCapturingTTSProvider();

      const inputFormat = {
        sampleRate: 16000,
        channels: 1,
        encoding: "linear16",
      } satisfies AudioFormat;

      const outputFormat = {
        sampleRate: 24000,
        channels: 1,
        encoding: "linear16",
      } satisfies AudioFormat;

      const agent = createAgent({
        stt: stt.provider,
        llm: llm.provider,
        tts: tts.provider,
        audio: { input: inputFormat, output: outputFormat },
      });

      agent.start();
      await tick();

      // Trigger TTS
      const sttCtx = stt.getCtx();
      sttCtx.speechStart();
      sttCtx.transcript("Hello", true);
      await tick();

      const llmCtx = llm.getCtx();
      llmCtx.sentence("Hi!", 0);
      await tick();

      const ttsCtx = tts.getCtx();
      expect(ttsCtx.audioFormat).toEqual(outputFormat);

      agent.stop();
    });
  });
});
