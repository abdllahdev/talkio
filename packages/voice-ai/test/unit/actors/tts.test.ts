/**
 * Unit Tests: TTS Actor
 *
 * Tests for the Text-to-Speech actor in isolation.
 * Note: Event emission is tested via integration tests since XState's
 * fromCallback actors use sendBack which requires a parent actor.
 */

import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import type { TTSContext, TTSProvider, NormalizedAgentConfig } from "../../../src";
import { ttsActor } from "../../../src/agent/actors/tts";
import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_CONFIG,
  mockLLMProvider,
  mockSTTProvider,
} from "../../helpers";

const SUPPORTED_OUTPUT_FORMATS = [
  { encoding: "linear16", sampleRate: 24000, channels: 1 },
  { encoding: "linear16", sampleRate: 16000, channels: 1 },
] as const;

describe("ttsActor", () => {
  const createTestTTSProvider = () => {
    let capturedCtx: TTSContext | null = null;
    let capturedText: string = "";
    const synthesizeMock = vi.fn((text: string, ctx: TTSContext) => {
      capturedCtx = ctx;
      capturedText = text;
    });

    const provider: TTSProvider = {
      metadata: {
        name: "TestTTS",
        version: "1.0.0",
        type: "tts",
        supportedOutputFormats: SUPPORTED_OUTPUT_FORMATS,
        defaultOutputFormat: SUPPORTED_OUTPUT_FORMATS[0],
      },
      synthesize: synthesizeMock,
    };

    return {
      provider,
      getCtx: () => capturedCtx,
      getText: () => capturedText,
      mocks: { synthesize: synthesizeMock },
    };
  };

  const createTestConfig = (ttsProvider: TTSProvider): NormalizedAgentConfig => ({
    stt: mockSTTProvider,
    llm: mockLLMProvider,
    tts: ttsProvider,
    audio: DEFAULT_AUDIO_CONFIG,
  });

  describe("initialization", () => {
    it("calls provider.synthesize() with text and context", () => {
      const tts = createTestTTSProvider();
      const config = createTestConfig(tts.provider);
      const abortController = new AbortController();

      const actor = createActor(ttsActor, {
        input: {
          config,
          text: "Hello world",
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      expect(tts.mocks.synthesize).toHaveBeenCalledTimes(1);
      expect(tts.getText()).toBe("Hello world");
      expect(tts.getCtx()).not.toBeNull();
    });

    it("passes audioFormat to provider context", () => {
      const tts = createTestTTSProvider();
      const config = createTestConfig(tts.provider);
      const abortController = new AbortController();

      const actor = createActor(ttsActor, {
        input: {
          config,
          text: "Test",
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const ctx = tts.getCtx();
      expect(ctx?.audioFormat).toEqual(DEFAULT_AUDIO_FORMAT);
    });

    it("passes abort signal to provider context", () => {
      const tts = createTestTTSProvider();
      const config = createTestConfig(tts.provider);
      const abortController = new AbortController();

      const actor = createActor(ttsActor, {
        input: {
          config,
          text: "Test",
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const ctx = tts.getCtx();
      expect(ctx?.signal).toBe(abortController.signal);
    });

    it("provides context methods for event emission", () => {
      const tts = createTestTTSProvider();
      const config = createTestConfig(tts.provider);
      const abortController = new AbortController();

      const actor = createActor(ttsActor, {
        input: {
          config,
          text: "Test",
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const ctx = tts.getCtx();
      if (!ctx) throw new Error("TTS context not captured");
      expect(typeof ctx.audioChunk).toBe("function");
      expect(typeof ctx.complete).toBe("function");
      expect(typeof ctx.error).toBe("function");
    });
  });
});
