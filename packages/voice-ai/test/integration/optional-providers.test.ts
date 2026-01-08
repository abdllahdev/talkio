/**
 * Integration Tests: Optional Providers
 *
 * Tests for VAD and Turn Detector fallback behavior.
 */

import { describe, expect, it } from "vitest";
import { createAgent, type AgentEvent } from "../../src";
import {
  createCapturingSTTProvider,
  createCapturingLLMProvider,
  createCapturingTTSProvider,
  createCapturingVADProvider,
  createCapturingTurnDetectorProvider,
  tick,
  expectEventExists,
} from "../helpers";

describe("optional providers", () => {
  describe("VAD fallback to STT", () => {
    it("agent works without VAD provider", async () => {
      const events: AgentEvent[] = [];

      const stt = createCapturingSTTProvider();
      const llm = createCapturingLLMProvider();
      const tts = createCapturingTTSProvider();

      // No VAD provider
      const agent = createAgent({
        stt: stt.provider,
        llm: llm.provider,
        tts: tts.provider,
        onEvent: (event) => events.push(event),
      });

      agent.start();
      await tick();

      // Should work using STT's built-in VAD
      const sttCtx = stt.getCtx();
      sttCtx.speechStart(); // STT provides VAD fallback
      sttCtx.transcript("Hello", true);
      await tick();

      expectEventExists(events, "human-turn:started");
      expectEventExists(events, "human-turn:ended");

      agent.stop();
    });

    it("agent works with custom VAD provider", async () => {
      const events: AgentEvent[] = [];

      const stt = createCapturingSTTProvider();
      const llm = createCapturingLLMProvider();
      const tts = createCapturingTTSProvider();
      const vad = createCapturingVADProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: llm.provider,
        tts: tts.provider,
        vad: vad.provider,
        onEvent: (event) => events.push(event),
      });

      agent.start();
      await tick();

      // VAD provider is initialized
      expect(vad.getCtx()).not.toBeNull();

      // VAD can detect speech
      const vadCtx = vad.getCtx();
      vadCtx.speechStart();

      expectEventExists(events, "human-turn:started");

      agent.stop();
    });

    it("VAD provider receives audio chunks", async () => {
      const stt = createCapturingSTTProvider();
      const vad = createCapturingVADProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: createCapturingLLMProvider().provider,
        tts: createCapturingTTSProvider().provider,
        vad: vad.provider,
      });

      agent.start();
      await tick();

      // Send audio
      const audioChunk = new Float32Array([0.1, 0.2, 0.3]);
      agent.sendAudio(audioChunk);

      // VAD should receive audio
      expect(vad.mocks.processAudio).toHaveBeenCalledWith(audioChunk);

      agent.stop();
    });

    it("emits vad:probability events for visualization", async () => {
      const events: AgentEvent[] = [];

      const stt = createCapturingSTTProvider();
      const vad = createCapturingVADProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: createCapturingLLMProvider().provider,
        tts: createCapturingTTSProvider().provider,
        vad: vad.provider,
        onEvent: (event) => events.push(event),
      });

      agent.start();
      await tick();

      // VAD emits probability
      const vadCtx = vad.getCtx();
      vadCtx.speechProbability(0.85);
      await tick();

      const probEvent = events.find((e) => e.type === "vad:probability");
      expect(probEvent).toBeDefined();

      agent.stop();
    });
  });

  describe("Turn Detector fallback to STT", () => {
    it("agent works without Turn Detector provider", async () => {
      const events: AgentEvent[] = [];

      const stt = createCapturingSTTProvider();
      const llm = createCapturingLLMProvider();
      const tts = createCapturingTTSProvider();

      // No Turn Detector provider
      const agent = createAgent({
        stt: stt.provider,
        llm: llm.provider,
        tts: tts.provider,
        onEvent: (event) => events.push(event),
      });

      agent.start();
      await tick();

      // Turn ends on final transcript (STT fallback)
      const sttCtx = stt.getCtx();
      sttCtx.speechStart();
      sttCtx.transcript("Hello world", true); // isFinal=true triggers turn end
      await tick();

      expectEventExists(events, "human-turn:ended");
      expectEventExists(events, "ai-turn:started");

      agent.stop();
    });

    it("agent works with custom Turn Detector provider", async () => {
      const events: AgentEvent[] = [];

      const stt = createCapturingSTTProvider();
      const llm = createCapturingLLMProvider();
      const tts = createCapturingTTSProvider();
      const turnDetector = createCapturingTurnDetectorProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: llm.provider,
        tts: tts.provider,
        turnDetector: turnDetector.provider,
        onEvent: (event) => events.push(event),
      });

      agent.start();
      await tick();

      // Turn detector is initialized
      expect(turnDetector.getCtx()).not.toBeNull();

      // Start speaking
      const sttCtx = stt.getCtx();
      sttCtx.speechStart();
      sttCtx.transcript("Hello world", false);
      await tick();

      // Turn detector decides turn ended
      const tdCtx = turnDetector.getCtx();
      tdCtx.turnEnd("Hello world");
      await tick();

      expectEventExists(events, "human-turn:ended");
      expectEventExists(events, "ai-turn:started");

      agent.stop();
    });

    it("Turn Detector receives transcript events", async () => {
      const stt = createCapturingSTTProvider();
      const turnDetector = createCapturingTurnDetectorProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: createCapturingLLMProvider().provider,
        tts: createCapturingTTSProvider().provider,
        turnDetector: turnDetector.provider,
      });

      agent.start();
      await tick();

      // Start turn
      const sttCtx = stt.getCtx();
      sttCtx.speechStart();
      sttCtx.transcript("Hello", false);
      await tick();

      expect(turnDetector.mocks.onTranscript).toHaveBeenCalledWith("Hello", false);

      agent.stop();
    });

    it("Turn Detector can abandon turns", async () => {
      const events: AgentEvent[] = [];

      const stt = createCapturingSTTProvider();
      const turnDetector = createCapturingTurnDetectorProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: createCapturingLLMProvider().provider,
        tts: createCapturingTTSProvider().provider,
        turnDetector: turnDetector.provider,
        onEvent: (event) => events.push(event),
      });

      agent.start();
      await tick();

      // Start speaking
      const sttCtx = stt.getCtx();
      sttCtx.speechStart();
      sttCtx.transcript("Um", false);
      await tick();

      // Turn detector abandons turn
      const tdCtx = turnDetector.getCtx();
      tdCtx.turnAbandoned("too_short");
      await tick();

      expectEventExists(events, "human-turn:abandoned");

      // AI turn should NOT start
      const aiTurnStarted = events.find((e) => e.type === "ai-turn:started");
      expect(aiTurnStarted).toBeUndefined();

      agent.stop();
    });
  });

  describe("combined optional providers", () => {
    it("both VAD and Turn Detector can be provided", async () => {
      const events: AgentEvent[] = [];

      const stt = createCapturingSTTProvider();
      const llm = createCapturingLLMProvider();
      const tts = createCapturingTTSProvider();
      const vad = createCapturingVADProvider();
      const turnDetector = createCapturingTurnDetectorProvider();

      const agent = createAgent({
        stt: stt.provider,
        llm: llm.provider,
        tts: tts.provider,
        vad: vad.provider,
        turnDetector: turnDetector.provider,
        onEvent: (event) => events.push(event),
      });

      agent.start();
      await tick();

      // Both providers are initialized
      expect(vad.getCtx()).not.toBeNull();
      expect(turnDetector.getCtx()).not.toBeNull();

      // Full flow: VAD detects speech, turn detector ends turn
      vad.getCtx().speechStart();
      const sttCtx = stt.getCtx();
      sttCtx.transcript("Hello there", false);
      await tick();

      turnDetector.getCtx().turnEnd("Hello there");
      await tick();

      expectEventExists(events, "human-turn:started");
      expectEventExists(events, "human-turn:ended");
      expectEventExists(events, "ai-turn:started");

      agent.stop();
    });
  });
});
