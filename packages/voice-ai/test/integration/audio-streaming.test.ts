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
      const chunk1 = createAudioChunk([0.1, 0.2, 0.3]);
      const chunk2 = createAudioChunk([0.4, 0.5, 0.6]);
      const chunk3 = createAudioChunk([0.7, 0.8, 0.9]);

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
        agent.sendAudio(createAudioChunk([i * 0.01]));
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
      const audioChunk1 = createAudioChunk([0.1, 0.2, 0.3]);
      const audioChunk2 = createAudioChunk([0.4, 0.5, 0.6]);
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

    it("audio chunks are Float32Arrays", async () => {
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
      ttsCtx.audioChunk(createAudioChunk([0.1, 0.2]));
      await tick();

      const audioEvents = findEvents(events, "ai-turn:audio");
      expect(audioEvents[0].audio).toBeInstanceOf(Float32Array);

      agent.stop();
    });
  });

  describe("audio format", () => {
    it("passes audio format to STT provider", async () => {
      const stt = createCapturingSTTProvider();

      const customFormat = {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
      } satisfies AudioFormat;

      const agent = createAgent({
        stt: stt.provider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
        audioFormat: customFormat,
      });

      agent.start();
      await tick();

      const ctx = stt.getCtx();
      expect(ctx.audioFormat).toEqual(customFormat);

      agent.stop();
    });

    it("passes audio format to TTS provider", async () => {
      const stt = createCapturingSTTProvider();
      const llm = createCapturingLLMProvider();
      const tts = createCapturingTTSProvider();

      const customFormat = {
        sampleRate: 48000,
        channels: 2,
        bitDepth: 32,
      } satisfies AudioFormat;

      const agent = createAgent({
        stt: stt.provider,
        llm: llm.provider,
        tts: tts.provider,
        audioFormat: customFormat,
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
      expect(ttsCtx.audioFormat).toEqual(customFormat);

      agent.stop();
    });
  });
});
