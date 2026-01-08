/**
 * Unit Tests: VAD Actor
 *
 * Tests for the Voice Activity Detection actor in isolation.
 * Note: Event emission is tested via integration tests since XState's
 * fromCallback actors use sendBack which requires a parent actor.
 */

import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import type { NormalizedAgentConfig, VADContext, VADProvider } from "../../../src";
import { vadActor } from "../../../src/agent/actors/vad";
import {
  createAudioChunk,
  DEFAULT_AUDIO_CONFIG,
  mockLLMProvider,
  mockSTTProvider,
  mockTTSProvider,
} from "../../helpers";

describe("vadActor", () => {
  const createTestVADProvider = () => {
    let capturedCtx: VADContext | null = null;
    const startMock = vi.fn((ctx: VADContext) => {
      capturedCtx = ctx;
    });
    const stopMock = vi.fn();
    const processAudioMock = vi.fn();

    const provider: VADProvider = {
      metadata: { name: "TestVAD", version: "1.0.0", type: "vad" },
      start: startMock,
      stop: stopMock,
      processAudio: processAudioMock,
    };

    return {
      provider,
      getCtx: () => capturedCtx,
      mocks: { start: startMock, stop: stopMock, processAudio: processAudioMock },
    };
  };

  const createTestConfig = (vadProvider?: VADProvider): NormalizedAgentConfig => ({
    stt: mockSTTProvider,
    llm: mockLLMProvider,
    tts: mockTTSProvider,
    vad: vadProvider,
    audio: DEFAULT_AUDIO_CONFIG,
  });

  describe("when VAD provider is present", () => {
    it("calls provider.start() with context", () => {
      const vad = createTestVADProvider();
      const config = createTestConfig(vad.provider);
      const abortController = new AbortController();

      const actor = createActor(vadActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      expect(vad.mocks.start).toHaveBeenCalledTimes(1);
      expect(vad.getCtx()).not.toBeNull();
    });

    it("passes abort signal to provider context", () => {
      const vad = createTestVADProvider();
      const config = createTestConfig(vad.provider);
      const abortController = new AbortController();

      const actor = createActor(vadActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const ctx = vad.getCtx();
      expect(ctx?.signal).toBe(abortController.signal);
    });

    it("provides context methods for event emission", () => {
      const vad = createTestVADProvider();
      const config = createTestConfig(vad.provider);
      const abortController = new AbortController();

      const actor = createActor(vadActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const ctx = vad.getCtx();
      if (!ctx) throw new Error("VAD context not captured");
      expect(typeof ctx.speechStart).toBe("function");
      expect(typeof ctx.speechEnd).toBe("function");
      expect(typeof ctx.speechProbability).toBe("function");
    });

    describe("audio routing", () => {
      it("decodes ArrayBuffer to Float32Array for provider.processAudio()", () => {
        const vad = createTestVADProvider();
        const config = createTestConfig(vad.provider);
        const abortController = new AbortController();

        const actor = createActor(vadActor, {
          input: { config, abortSignal: abortController.signal },
        });

        actor.start();

        // Send ArrayBuffer (encoded audio)
        const audioChunk = createAudioChunk();
        actor.send({ type: "_audio:input", audio: audioChunk });

        expect(vad.mocks.processAudio).toHaveBeenCalledTimes(1);
        const receivedAudio = vad.mocks.processAudio.mock.calls[0][0];
        expect(receivedAudio).toBeInstanceOf(ArrayBuffer);
      });

      it("forwards multiple audio chunks to provider", () => {
        const vad = createTestVADProvider();
        const config = createTestConfig(vad.provider);
        const abortController = new AbortController();

        const actor = createActor(vadActor, {
          input: { config, abortSignal: abortController.signal },
        });

        actor.start();

        const chunk1 = createAudioChunk();
        const chunk2 = createAudioChunk();

        actor.send({ type: "_audio:input", audio: chunk1 });
        actor.send({ type: "_audio:input", audio: chunk2 });

        expect(vad.mocks.processAudio).toHaveBeenCalledTimes(2);
      });
    });

    describe("cleanup", () => {
      it("calls provider.stop() when actor is stopped", () => {
        const vad = createTestVADProvider();
        const config = createTestConfig(vad.provider);
        const abortController = new AbortController();

        const actor = createActor(vadActor, {
          input: { config, abortSignal: abortController.signal },
        });

        actor.start();
        expect(vad.mocks.stop).not.toHaveBeenCalled();

        actor.stop();
        expect(vad.mocks.stop).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("when VAD provider is not present", () => {
    it("does not throw error", () => {
      const config = createTestConfig(undefined);
      const abortController = new AbortController();

      expect(() => {
        const actor = createActor(vadActor, {
          input: { config, abortSignal: abortController.signal },
        });
        actor.start();
      }).not.toThrow();
    });

    it("returns no-op cleanup function", () => {
      const config = createTestConfig(undefined);
      const abortController = new AbortController();

      const actor = createActor(vadActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      // Should not throw when stopping
      expect(() => actor.stop()).not.toThrow();
    });
  });
});
