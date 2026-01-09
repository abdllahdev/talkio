/**
 * Unit Tests: Agent Context
 *
 * Tests for the machine context initialization.
 */

import { describe, expect, it } from "vitest";
import { createInitialContext } from "../../../src/agent/context";
import {
  DEFAULT_AUDIO_CONFIG,
  mockLLMProvider,
  mockSTTProvider,
  mockTTSProvider,
  mockTurnDetectorProvider,
  mockVADProvider,
} from "../../helpers";

describe("createInitialContext", () => {
  const baseConfig = {
    stt: mockSTTProvider,
    llm: mockLLMProvider,
    tts: mockTTSProvider,
    audio: DEFAULT_AUDIO_CONFIG,
  };

  describe("basic initialization", () => {
    it("creates context with correct defaults", () => {
      const context = createInitialContext(baseConfig, null);

      expect(context.messages).toEqual([]);
      expect(context.partialTranscript).toBe("");
      expect(context.currentResponse).toBe("");
      expect(context.sentenceIndex).toBe(0);
      expect(context.isSpeaking).toBe(false);
      expect(context.speechStartTime).toBeNull();
      expect(context.sessionAbortController).toBeNull();
      expect(context.turnAbortController).toBeNull();
      expect(context.llmRef).toBeNull();
      expect(context.ttsRef).toBeNull();
      expect(context.sentenceQueue).toEqual([]);
      expect(context.aiTurnHadAudio).toBe(false);
      expect(context.lastLLMResponse).toBe("");
    });

    it("stores config reference", () => {
      const context = createInitialContext(baseConfig, null);

      expect(context.config).toBe(baseConfig);
    });

    it("stores audioStreamController", () => {
      const mockController = {} as ReadableStreamDefaultController<ArrayBuffer>;
      const context = createInitialContext(baseConfig, mockController);

      expect(context.audioStreamController).toBe(mockController);
    });
  });

  describe("vadSource flag", () => {
    it("sets vadSource to 'stt' when no VAD provider", () => {
      const context = createInitialContext(baseConfig, null);

      expect(context.vadSource).toBe("stt");
    });

    it("sets vadSource to 'adapter' when VAD provider present", () => {
      const configWithVAD = {
        ...baseConfig,
        vad: mockVADProvider,
      };
      const context = createInitialContext(configWithVAD, null);

      expect(context.vadSource).toBe("adapter");
    });
  });

  describe("turnSource flag", () => {
    it("sets turnSource to 'stt' when no turn detector provider", () => {
      const context = createInitialContext(baseConfig, null);

      expect(context.turnSource).toBe("stt");
    });

    it("sets turnSource to 'adapter' when turn detector provider present", () => {
      const configWithTurnDetector = {
        ...baseConfig,
        turnDetector: mockTurnDetectorProvider,
      };
      const context = createInitialContext(configWithTurnDetector, null);

      expect(context.turnSource).toBe("adapter");
    });
  });

  describe("metrics initialization", () => {
    it("initializes metrics state correctly", () => {
      const context = createInitialContext(baseConfig, null);

      expect(context.metrics).toBeDefined();
      expect(context.metrics.totalTurns).toBe(0);
      expect(context.metrics.completedTurns).toBe(0);
      expect(context.metrics.interruptedTurns).toBe(0);
      expect(context.metrics.abandonedTurns).toBe(0);
      expect(context.metrics.sessionStartedAt).toBeNull();
    });

    it("initializes error tracking by source", () => {
      const context = createInitialContext(baseConfig, null);

      expect(context.metrics.errorsBySource).toEqual({
        stt: 0,
        llm: 0,
        tts: 0,
        vad: 0,
      });
    });
  });

  describe("with all optional providers", () => {
    it("handles full configuration correctly", () => {
      const fullConfig = {
        ...baseConfig,
        vad: mockVADProvider,
        turnDetector: mockTurnDetectorProvider,
        interruption: {
          enabled: true,
          minDurationMs: 100,
        },
      };

      const context = createInitialContext(fullConfig, null);

      expect(context.vadSource).toBe("adapter");
      expect(context.turnSource).toBe("adapter");
      expect(context.config).toBe(fullConfig);
    });
  });
});
