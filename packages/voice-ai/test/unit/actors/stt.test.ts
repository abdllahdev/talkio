/**
 * Unit Tests: STT Actor
 *
 * Tests for the Speech-to-Text actor in isolation.
 * Note: Event emission is tested via integration tests since XState's
 * fromCallback actors use sendBack which requires a parent actor.
 */

import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import type { STTContext, STTProvider, NormalizedAgentConfig } from "../../../src";
import { sttActor } from "../../../src/agent/actors/stt";
import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_CONFIG,
  createAudioChunk,
  mockLLMProvider,
  mockTTSProvider,
} from "../../helpers";

const SUPPORTED_INPUT_FORMATS = [
  { encoding: "linear16", sampleRate: 16000, channels: 1 },
  { encoding: "linear16", sampleRate: 24000, channels: 1 },
  { encoding: "mulaw", sampleRate: 8000, channels: 1 },
] as const;

describe("sttActor", () => {
  const createTestSTTProvider = () => {
    let capturedCtx: STTContext | null = null;
    const startMock = vi.fn((ctx: STTContext) => {
      capturedCtx = ctx;
    });
    const stopMock = vi.fn();
    const sendAudioMock = vi.fn();

    const provider: STTProvider = {
      metadata: {
        name: "TestSTT",
        version: "1.0.0",
        type: "stt",
        supportedInputFormats: SUPPORTED_INPUT_FORMATS,
        defaultInputFormat: SUPPORTED_INPUT_FORMATS[0],
      },
      start: startMock,
      stop: stopMock,
      sendAudio: sendAudioMock,
    };

    return {
      provider,
      getCtx: () => capturedCtx,
      mocks: { start: startMock, stop: stopMock, sendAudio: sendAudioMock },
    };
  };

  const createTestConfig = (sttProvider: STTProvider): NormalizedAgentConfig => ({
    stt: sttProvider,
    llm: mockLLMProvider,
    tts: mockTTSProvider,
    audio: DEFAULT_AUDIO_CONFIG,
  });

  describe("initialization", () => {
    it("calls provider.start() with context", () => {
      const stt = createTestSTTProvider();
      const config = createTestConfig(stt.provider);
      const abortController = new AbortController();

      const actor = createActor(sttActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      expect(stt.mocks.start).toHaveBeenCalledTimes(1);
      expect(stt.getCtx()).not.toBeNull();
    });

    it("passes audioFormat to provider context", () => {
      const stt = createTestSTTProvider();
      const config = createTestConfig(stt.provider);
      const abortController = new AbortController();

      const actor = createActor(sttActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const ctx = stt.getCtx();
      expect(ctx?.audioFormat).toEqual(DEFAULT_AUDIO_FORMAT);
    });

    it("passes abort signal to provider context", () => {
      const stt = createTestSTTProvider();
      const config = createTestConfig(stt.provider);
      const abortController = new AbortController();

      const actor = createActor(sttActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const ctx = stt.getCtx();
      expect(ctx?.signal).toBe(abortController.signal);
    });

    it("provides context methods for event emission", () => {
      const stt = createTestSTTProvider();
      const config = createTestConfig(stt.provider);
      const abortController = new AbortController();

      const actor = createActor(sttActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const ctx = stt.getCtx();
      if (!ctx) throw new Error("STT context not captured");
      expect(typeof ctx.transcript).toBe("function");
      expect(typeof ctx.speechStart).toBe("function");
      expect(typeof ctx.speechEnd).toBe("function");
      expect(typeof ctx.error).toBe("function");
    });
  });

  describe("audio routing", () => {
    it("forwards _audio:input events to provider.sendAudio()", () => {
      const stt = createTestSTTProvider();
      const config = createTestConfig(stt.provider);
      const abortController = new AbortController();

      const actor = createActor(sttActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const audioChunk = createAudioChunk();
      actor.send({ type: "_audio:input", audio: audioChunk, timestamp: Date.now() });

      expect(stt.mocks.sendAudio).toHaveBeenCalledWith(audioChunk);
    });

    it("forwards multiple audio chunks to provider", () => {
      const stt = createTestSTTProvider();
      const config = createTestConfig(stt.provider);
      const abortController = new AbortController();

      const actor = createActor(sttActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const chunk1 = createAudioChunk();
      const chunk2 = createAudioChunk();
      const chunk3 = createAudioChunk();

      actor.send({ type: "_audio:input", audio: chunk1, timestamp: Date.now() });
      actor.send({ type: "_audio:input", audio: chunk2, timestamp: Date.now() });
      actor.send({ type: "_audio:input", audio: chunk3, timestamp: Date.now() });

      expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(3);
      expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(1, chunk1);
      expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(2, chunk2);
      expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(3, chunk3);
    });
  });

  describe("cleanup", () => {
    it("calls provider.stop() when actor is stopped", () => {
      const stt = createTestSTTProvider();
      const config = createTestConfig(stt.provider);
      const abortController = new AbortController();

      const actor = createActor(sttActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();
      expect(stt.mocks.stop).not.toHaveBeenCalled();

      actor.stop();
      expect(stt.mocks.stop).toHaveBeenCalledTimes(1);
    });
  });
});
