/**
 * Unit Tests: createAgent
 *
 * Tests for the agent factory function.
 */

import { describe, expect, it } from "vitest";
import { createAgent } from "../../../src";
import {
  LOW_QUALITY_AUDIO_FORMAT,
  mockLLMProvider,
  mockSTTProvider,
  mockTTSProvider,
} from "../../helpers";

describe("createAgent", () => {
  describe("agent creation", () => {
    it("creates an agent with required providers", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(typeof agent.id).toBe("string");
      expect(agent.id.length).toBeGreaterThan(0);
    });
  });

  describe("agent interface", () => {
    it("exposes required methods", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      expect(typeof agent.start).toBe("function");
      expect(typeof agent.stop).toBe("function");
      expect(typeof agent.sendAudio).toBe("function");
      expect(typeof agent.subscribe).toBe("function");
      expect(typeof agent.getSnapshot).toBe("function");
    });

    it("exposes audioStream as ReadableStream", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      expect(agent.audioStream).toBeInstanceOf(ReadableStream);
    });
  });

  describe("configuration", () => {
    it("creates an agent with onEvent callback", () => {
      const events: unknown[] = [];

      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
        onEvent: (event) => {
          events.push(event);
        },
      });

      expect(agent).toBeDefined();
    });

    it("accepts audioFormat configuration", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
        audioFormat: LOW_QUALITY_AUDIO_FORMAT,
      });

      expect(agent).toBeDefined();
    });

    it("accepts bargeIn configuration", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
        bargeIn: {
          enabled: true,
          minDurationMs: 100,
        },
      });

      expect(agent).toBeDefined();
    });
  });

  describe("initial state", () => {
    it("returns initial state snapshot", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      const snapshot = agent.getSnapshot();

      expect(snapshot.value).toBe("idle");
      expect(snapshot.isRunning).toBe(false);
      expect(snapshot.isSpeaking).toBe(false);
      expect(snapshot.messages).toEqual([]);
      expect(snapshot.partialTranscript).toBe("");
      expect(snapshot.status).toBe("active");
    });

    it("returns initial metrics in snapshot", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      const snapshot = agent.getSnapshot();

      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.metrics.turns.total).toBe(0);
      expect(snapshot.metrics.turns.completed).toBe(0);
      expect(snapshot.metrics.errors.total).toBe(0);
    });
  });

  describe("subscription", () => {
    it("subscribe returns unsubscribe function", () => {
      const agent = createAgent({
        stt: mockSTTProvider,
        llm: mockLLMProvider,
        tts: mockTTSProvider,
      });

      const unsubscribe = agent.subscribe(() => {});

      expect(typeof unsubscribe).toBe("function");
    });
  });
});
