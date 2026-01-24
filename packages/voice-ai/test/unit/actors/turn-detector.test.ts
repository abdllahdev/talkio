/**
 * Unit Tests: Turn Detector Actor
 *
 * Tests for the Turn Detector actor in isolation.
 * Note: Event emission is tested via integration tests since XState's
 * fromCallback actors use sendBack which requires a parent actor.
 */

import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

import type { TurnDetectorContext, TurnDetectorProvider } from "../../../src";
import { turnDetectorActor } from "../../../src/agent/actors/turn-detector";
import { mockLLMProvider, mockSTTProvider, mockTTSProvider } from "../../helpers";

describe("turnDetectorActor", () => {
  const createTestTurnDetectorProvider = () => {
    let capturedCtx: TurnDetectorContext | null = null;
    const startMock = vi.fn((ctx: TurnDetectorContext) => {
      capturedCtx = ctx;
    });
    const stopMock = vi.fn();
    const onTranscriptMock = vi.fn();
    const onSpeechEndMock = vi.fn();

    const provider: TurnDetectorProvider = {
      metadata: { name: "TestTurnDetector", version: "1.0.0", type: "turn-detector" },
      start: startMock,
      stop: stopMock,
      onTranscript: onTranscriptMock,
      onSpeechEnd: onSpeechEndMock,
    };

    return {
      provider,
      getCtx: () => capturedCtx,
      mocks: {
        start: startMock,
        stop: stopMock,
        onTranscript: onTranscriptMock,
        onSpeechEnd: onSpeechEndMock,
      },
    };
  };

  const createTestConfig = (turnDetectorProvider?: TurnDetectorProvider) => ({
    stt: mockSTTProvider,
    llm: mockLLMProvider,
    tts: mockTTSProvider,
    turnDetector: turnDetectorProvider,
  });

  describe("when turn detector provider is present", () => {
    it("calls provider.start() with context", () => {
      const turnDetector = createTestTurnDetectorProvider();
      const config = createTestConfig(turnDetector.provider);
      const abortController = new AbortController();

      const actor = createActor(turnDetectorActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      expect(turnDetector.mocks.start).toHaveBeenCalledTimes(1);
      expect(turnDetector.getCtx()).not.toBeNull();
    });

    it("passes abort signal to provider context", () => {
      const turnDetector = createTestTurnDetectorProvider();
      const config = createTestConfig(turnDetector.provider);
      const abortController = new AbortController();

      const actor = createActor(turnDetectorActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const ctx = turnDetector.getCtx();
      expect(ctx?.signal).toBe(abortController.signal);
    });

    it("provides context methods for event emission", () => {
      const turnDetector = createTestTurnDetectorProvider();
      const config = createTestConfig(turnDetector.provider);
      const abortController = new AbortController();

      const actor = createActor(turnDetectorActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      const ctx = turnDetector.getCtx();
      if (!ctx) throw new Error("TurnDetector context not captured");
      expect(typeof ctx.turnEnd).toBe("function");
      expect(typeof ctx.turnAbandoned).toBe("function");
    });

    describe("event forwarding", () => {
      it("forwards _stt:transcript events to provider.onTranscript()", () => {
        const turnDetector = createTestTurnDetectorProvider();
        const config = createTestConfig(turnDetector.provider);
        const abortController = new AbortController();

        const actor = createActor(turnDetectorActor, {
          input: { config, abortSignal: abortController.signal },
        });

        actor.start();

        actor.send({
          type: "_stt:transcript",
          text: "Hello",
          isFinal: false,
          timestamp: Date.now(),
        });

        expect(turnDetector.mocks.onTranscript).toHaveBeenCalledWith("Hello", false);
      });

      it("forwards final transcripts to provider.onTranscript()", () => {
        const turnDetector = createTestTurnDetectorProvider();
        const config = createTestConfig(turnDetector.provider);
        const abortController = new AbortController();

        const actor = createActor(turnDetectorActor, {
          input: { config, abortSignal: abortController.signal },
        });

        actor.start();

        actor.send({
          type: "_stt:transcript",
          text: "Complete sentence.",
          isFinal: true,
          timestamp: Date.now(),
        });

        expect(turnDetector.mocks.onTranscript).toHaveBeenCalledWith("Complete sentence.", true);
      });

      it("forwards _vad:speech-end events to provider.onSpeechEnd()", () => {
        const turnDetector = createTestTurnDetectorProvider();
        const config = createTestConfig(turnDetector.provider);
        const abortController = new AbortController();

        const actor = createActor(turnDetectorActor, {
          input: { config, abortSignal: abortController.signal },
        });

        actor.start();

        actor.send({ type: "_vad:speech-end", duration: 2000, timestamp: Date.now() });

        expect(turnDetector.mocks.onSpeechEnd).toHaveBeenCalledWith(2000);
      });
    });

    describe("cleanup", () => {
      it("calls provider.stop() when actor is stopped", () => {
        const turnDetector = createTestTurnDetectorProvider();
        const config = createTestConfig(turnDetector.provider);
        const abortController = new AbortController();

        const actor = createActor(turnDetectorActor, {
          input: { config, abortSignal: abortController.signal },
        });

        actor.start();
        expect(turnDetector.mocks.stop).not.toHaveBeenCalled();

        actor.stop();
        expect(turnDetector.mocks.stop).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("when turn detector provider is not present", () => {
    it("does not throw error", () => {
      const config = createTestConfig(undefined);
      const abortController = new AbortController();

      expect(() => {
        const actor = createActor(turnDetectorActor, {
          input: { config, abortSignal: abortController.signal },
        });
        actor.start();
      }).not.toThrow();
    });

    it("returns no-op cleanup function", () => {
      const config = createTestConfig(undefined);
      const abortController = new AbortController();

      const actor = createActor(turnDetectorActor, {
        input: { config, abortSignal: abortController.signal },
      });

      actor.start();

      // Should not throw when stopping
      expect(() => actor.stop()).not.toThrow();
    });
  });
});
