/**
 * Agent State Machine
 *
 * This is the core XState machine that orchestrates the voice agent.
 * It manages turn-taking, barge-in detection, and coordination between
 * STT, LLM, and TTS providers.
 *
 * Architecture:
 * - Uses parallel states for independent concerns (listening, responding, streaming)
 * - Uses emit() for external event notification (public events only)
 * - Uses invoke for persistent actors (STT, VAD, turn detector)
 * - Uses spawn for dynamic actors (LLM, TTS per turn/sentence)
 * - Audio output is handled internally via ReadableStream exposed on Agent
 *
 * Event Architecture:
 * - Internal events (prefixed with "_") are handled by the machine but not exposed
 * - Public events (no prefix) are emitted to users via onEvent callback
 *
 * Flow:
 * 1. User speaks → STT transcribes
 * 2. Turn ends → LLM generates response
 * 3. LLM streams sentences → TTS synthesizes each
 * 4. TTS produces audio → Chunks pushed to audioStream and emitted as events
 * 5. TTS completes → AI turn ends
 */

import { nanoid } from "nanoid";
import { assign, emit, sendTo, setup } from "xstate";
import type { AgentMachineOutput } from "../types/common";
import type { AgentConfig } from "../types/config";
import type { MachineEvent, PublicAgentEvent } from "../types/events";
import type { AITurnMetrics, HumanTurnMetrics } from "../types/metrics";
import {
  audioStreamerActor,
  llmActor,
  sttActor,
  ttsActor,
  turnDetectorActor,
  vadActor,
} from "./actors";
import { type AgentMachineContext, createInitialContext } from "./context";

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════════

const agentMachineSetup = setup({
  types: {
    context: {} as AgentMachineContext,
    events: {} as MachineEvent,
    input: {} as {
      config: AgentConfig;
      audioStreamController: ReadableStreamDefaultController<Float32Array> | null;
    },
    output: {} as AgentMachineOutput,
    emitted: {} as PublicAgentEvent,
  },

  actors: {
    stt: sttActor,
    vad: vadActor,
    turnDetector: turnDetectorActor,
    llm: llmActor,
    tts: ttsActor,
    audioStreamer: audioStreamerActor,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARDS
  // ═══════════════════════════════════════════════════════════════════════════

  guards: {
    // VAD source checks
    hasVADAdapter: ({ context }) => context.vadSource === "adapter",
    usesSTTForVAD: ({ context }) => context.vadSource === "stt",

    // Turn detector checks
    hasTurnDetector: ({ context }) => context.turnSource === "adapter",
    noTurnDetector: ({ context }) => context.turnSource === "stt",

    // Barge-in checks
    shouldBargeIn: ({ context, event }) => {
      if (!context.config.bargeIn?.enabled || !context.isSpeaking) return false;
      if (event.type === "_vad:speech-end") {
        return event.duration >= (context.config.bargeIn?.minDurationMs ?? 0);
      }
      return true;
    },

    canBargeInFromSTT: ({ context }) =>
      context.vadSource === "stt" &&
      (context.config.bargeIn?.enabled ?? false) &&
      context.isSpeaking,

    // Queue checks
    hasPendingSentences: ({ context }) => context.sentenceQueue.length > 0,

    // Speaking state
    isSpeaking: ({ context }) => context.isSpeaking,
    isNotSpeaking: ({ context }) => !context.isSpeaking,

    // AI turn tracking
    aiTurnHadAudio: ({ context }) => context.aiTurnHadAudio,
    aiTurnHadNoAudio: ({ context }) => !context.aiTurnHadAudio,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  actions: {
    // ─────────────────────────────────────────────────────────────────────────
    // Public event emitters (semantic events for users)
    // ─────────────────────────────────────────────────────────────────────────

    // Agent lifecycle
    emitAgentStarted: emit({ type: "agent:started" }),
    emitAgentStopped: emit({ type: "agent:stopped" }),
    emitAgentError: emit(({ event }) => {
      let error: Error;
      let source: "stt" | "llm" | "tts" | "vad";

      if (event.type === "_stt:error") {
        error = event.error;
        source = "stt";
      } else if (event.type === "_llm:error") {
        error = event.error;
        source = "llm";
      } else if (event.type === "_tts:error") {
        error = event.error;
        source = "tts";
      } else {
        error = new Error("Unknown error");
        source = "stt";
      }

      return { type: "agent:error" as const, error, source };
    }),

    // Human turn events
    emitHumanTurnStarted: emit({ type: "human-turn:started" }),
    emitHumanTurnTranscript: emit(({ event }) => {
      if (event.type === "_stt:transcript") {
        return {
          type: "human-turn:transcript" as const,
          text: event.text,
          isFinal: event.isFinal,
        };
      }
      return { type: "human-turn:transcript" as const, text: "", isFinal: false };
    }),
    emitHumanTurnEnded: emit(({ context, event }) => {
      let transcript = "";
      if (event.type === "_turn:end") {
        transcript = event.transcript;
      } else if (event.type === "_stt:transcript" && event.isFinal) {
        transcript = event.text;
      }
      const metrics: HumanTurnMetrics = {
        speechDuration: context.metrics.humanSpeechDuration,
        transcriptLength: context.metrics.humanTranscriptLength,
      };
      return { type: "human-turn:ended" as const, transcript, metrics };
    }),
    emitHumanTurnAbandoned: emit(({ event }) => {
      const reason = event.type === "_turn:abandoned" ? event.reason : "unknown";
      return { type: "human-turn:abandoned" as const, reason };
    }),

    // AI turn events
    emitAITurnStarted: emit({ type: "ai-turn:started" }),
    emitAITurnToken: emit(({ event }) => {
      const token = event.type === "_llm:token" ? event.token : "";
      return { type: "ai-turn:token" as const, token };
    }),
    emitAITurnSentence: emit(({ event }) => {
      if (event.type === "_llm:sentence") {
        return {
          type: "ai-turn:sentence" as const,
          sentence: event.sentence,
          index: event.index,
        };
      }
      return { type: "ai-turn:sentence" as const, sentence: "", index: 0 };
    }),
    emitAITurnAudio: emit(({ event }) => {
      const audio = event.type === "_tts:chunk" ? event.audio : new Float32Array(0);
      return { type: "ai-turn:audio" as const, audio };
    }),
    emitAITurnEndedWithAudio: emit(({ context }) => {
      const m = context.metrics;
      const aiTurnEndTime = m.aiTurnEndTime ?? Date.now();
      const metrics: AITurnMetrics = {
        timeToFirstToken:
          m.firstTokenTime && m.aiTurnStartTime ? m.firstTokenTime - m.aiTurnStartTime : 0,
        timeToFirstSentence:
          m.firstSentenceTime && m.firstTokenTime ? m.firstSentenceTime - m.firstTokenTime : 0,
        timeToFirstAudio:
          m.firstAudioTime && m.firstSentenceTime ? m.firstAudioTime - m.firstSentenceTime : 0,
        totalDuration: m.aiTurnStartTime ? aiTurnEndTime - m.aiTurnStartTime : 0,
        tokenCount: m.currentTokenCount,
        sentenceCount: m.currentSentenceCount,
        responseLength: m.currentResponseLength,
        audioChunkCount: m.currentAudioChunkCount,
        totalAudioSamples: m.currentAudioSamples,
        wasInterrupted: false,
      };
      return {
        type: "ai-turn:ended" as const,
        text: context.lastLLMResponse,
        wasSpoken: true,
        metrics,
      };
    }),
    emitAITurnEndedWithoutAudio: emit(({ context, event }) => {
      const m = context.metrics;
      const aiTurnEndTime = m.aiTurnEndTime ?? Date.now();
      const metrics: AITurnMetrics = {
        timeToFirstToken:
          m.firstTokenTime && m.aiTurnStartTime ? m.firstTokenTime - m.aiTurnStartTime : 0,
        timeToFirstSentence:
          m.firstSentenceTime && m.firstTokenTime ? m.firstSentenceTime - m.firstTokenTime : 0,
        timeToFirstAudio: 0,
        totalDuration: m.aiTurnStartTime ? aiTurnEndTime - m.aiTurnStartTime : 0,
        tokenCount: m.currentTokenCount,
        sentenceCount: m.currentSentenceCount,
        responseLength: m.currentResponseLength,
        audioChunkCount: 0,
        totalAudioSamples: 0,
        wasInterrupted: false,
      };
      return {
        type: "ai-turn:ended" as const,
        text: event.type === "_llm:complete" ? event.fullText : "",
        wasSpoken: false,
        metrics,
      };
    }),
    emitAITurnInterrupted: emit(({ context }) => {
      const m = context.metrics;
      const now = Date.now();
      const metrics: AITurnMetrics = {
        timeToFirstToken:
          m.firstTokenTime && m.aiTurnStartTime ? m.firstTokenTime - m.aiTurnStartTime : 0,
        timeToFirstSentence:
          m.firstSentenceTime && m.firstTokenTime ? m.firstSentenceTime - m.firstTokenTime : 0,
        timeToFirstAudio:
          m.firstAudioTime && m.firstSentenceTime ? m.firstAudioTime - m.firstSentenceTime : 0,
        totalDuration: m.aiTurnStartTime ? now - m.aiTurnStartTime : 0,
        tokenCount: m.currentTokenCount,
        sentenceCount: m.currentSentenceCount,
        responseLength: m.currentResponseLength,
        audioChunkCount: m.currentAudioChunkCount,
        totalAudioSamples: m.currentAudioSamples,
        wasInterrupted: true,
      };
      return {
        type: "ai-turn:interrupted" as const,
        partialText: context.currentResponse,
        metrics,
      };
    }),

    // Debug events
    emitVADProbability: emit(({ event }) => {
      const value = event.type === "_vad:probability" ? event.value : 0;
      return { type: "vad:probability" as const, value };
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // Context mutations (pure assignments)
    // ─────────────────────────────────────────────────────────────────────────
    setSpeechStartTime: assign({ speechStartTime: () => Date.now() }),
    clearSpeechStartTime: assign({ speechStartTime: () => null }),

    updatePartialTranscriptFromEvent: assign({
      partialTranscript: ({ event }) =>
        event.type === "_stt:transcript" && !event.isFinal ? event.text : "",
    }),

    clearPartialTranscript: assign({ partialTranscript: () => "" }),

    addUserMessageFromTurnEnd: assign({
      messages: ({ context, event }) => {
        const text = event.type === "_turn:end" ? event.transcript : "";
        return [...context.messages, { role: "user" as const, content: text }];
      },
      partialTranscript: () => "",
    }),

    addUserMessageFromSTT: assign({
      messages: ({ context, event }) => {
        const text = event.type === "_stt:transcript" && event.isFinal ? event.text : "";
        return [...context.messages, { role: "user" as const, content: text }];
      },
      partialTranscript: () => "",
    }),

    addAssistantMessageFromEvent: assign({
      messages: ({ context, event }) => {
        const fullText = event.type === "_llm:complete" ? event.fullText : "";
        return [...context.messages, { role: "assistant" as const, content: fullText }];
      },
      currentResponse: () => "",
      sentenceIndex: () => 0,
      lastLLMResponse: ({ event }) => (event.type === "_llm:complete" ? event.fullText : ""),
    }),

    updateCurrentResponseFromEvent: assign({
      currentResponse: ({ context, event }) => {
        const token = event.type === "_llm:token" ? event.token : "";
        return context.currentResponse + token;
      },
    }),

    setIsSpeaking: assign({ isSpeaking: () => true }),
    clearIsSpeaking: assign({ isSpeaking: () => false }),

    // AI turn audio tracking
    setAITurnHadAudio: assign({ aiTurnHadAudio: () => true }),
    clearAITurnHadAudio: assign({ aiTurnHadAudio: () => false }),

    // Abort controller management
    createAbortController: assign({ abortController: () => new AbortController() }),

    abortCurrentController: ({ context }) => {
      context.abortController?.abort();
    },

    createNewAbortController: assign({
      abortController: () => new AbortController(),
    }),

    clearDynamicActorRefs: assign({
      llmRef: () => null,
      ttsRef: () => null,
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // Actor communication (using sendTo for invoked actors)
    // ─────────────────────────────────────────────────────────────────────────
    forwardAudioToSTT: sendTo("stt", ({ event }) => event),
    forwardAudioToVAD: sendTo("vad", ({ event }) => event),
    forwardToTurnDetector: sendTo("turnDetector", ({ event }) => event),
    forwardAudioToStreamer: sendTo("audioStreamer", ({ event }) => {
      if (event.type === "_tts:chunk") {
        return { type: "_audio:output-chunk" as const, audio: event.audio };
      }
      return { type: "_audio:output-chunk" as const, audio: new Float32Array(0) };
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // Adapter control (fire-and-forget side effects)
    // ─────────────────────────────────────────────────────────────────────────
    stopLLM: ({ context }) => {
      context.config.llm.cancel();
    },

    stopTTS: ({ context }) => {
      context.config.tts.cancel();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Dynamic actor spawning (LLM, TTS per turn/sentence)
    // ─────────────────────────────────────────────────────────────────────────
    spawnLLM: assign({
      llmRef: ({ context, spawn, self }) => {
        const signal = context.abortController?.signal ?? new AbortController().signal;
        return spawn("llm", {
          input: {
            config: context.config,
            messages: context.messages,
            abortSignal: signal,
            sayFn: (text: string) => self.send({ type: "_filler:say", text }),
            interruptFn: () => self.send({ type: "_filler:interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          },
        });
      },
    }),

    spawnTTSFromSentence: assign({
      ttsRef: ({ context, spawn, event }) => {
        const text = event.type === "_llm:sentence" ? event.sentence : "";
        const signal = context.abortController?.signal ?? new AbortController().signal;
        return spawn("tts", {
          systemId: `currentTTS-${nanoid()}`,
          input: {
            config: context.config,
            text,
            abortSignal: signal,
          },
        });
      },
    }),

    spawnTTSFromFiller: assign({
      ttsRef: ({ context, spawn, event }) => {
        const text = event.type === "_filler:say" ? event.text : "";
        const signal = context.abortController?.signal ?? new AbortController().signal;
        return spawn("tts", {
          systemId: `currentTTS-${nanoid()}`,
          input: {
            config: context.config,
            text,
            abortSignal: signal,
          },
        });
      },
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // Metrics tracking actions
    // ─────────────────────────────────────────────────────────────────────────

    // Session start
    recordSessionStart: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        sessionStartedAt: Date.now(),
      }),
    }),

    // Human turn tracking
    recordHumanTurnStart: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        humanTurnStartTime: Date.now(),
        totalTurns: context.metrics.totalTurns + 1,
      }),
    }),

    recordHumanTurnEnd: assign({
      metrics: ({ context, event }) => {
        const humanTurnEndTime = Date.now();
        // Get speech duration from VAD event if available
        let speechDuration = context.metrics.humanSpeechDuration;
        if (event.type === "_vad:speech-end") {
          speechDuration = event.duration;
        } else if (context.metrics.humanTurnStartTime) {
          // Fallback to calculated duration
          speechDuration = humanTurnEndTime - context.metrics.humanTurnStartTime;
        }

        // Get transcript length from turn end event
        let transcriptLength = 0;
        if (event.type === "_turn:end") {
          transcriptLength = event.transcript.length;
        } else if (event.type === "_stt:transcript" && event.isFinal) {
          transcriptLength = event.text.length;
        }

        return {
          ...context.metrics,
          humanTurnEndTime,
          humanSpeechDuration: speechDuration,
          humanTranscriptLength: transcriptLength,
          totalUserSpeechDuration: context.metrics.totalUserSpeechDuration + speechDuration,
          totalUserTranscriptChars: context.metrics.totalUserTranscriptChars + transcriptLength,
        };
      },
    }),

    recordHumanTurnAbandoned: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        abandonedTurns: context.metrics.abandonedTurns + 1,
      }),
    }),

    // AI turn tracking
    recordAITurnStart: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        aiTurnStartTime: Date.now(),
        // Reset current turn counters
        currentTokenCount: 0,
        currentSentenceCount: 0,
        currentResponseLength: 0,
        currentAudioChunkCount: 0,
        currentAudioSamples: 0,
        firstTokenTime: null,
        firstSentenceTime: null,
        firstAudioTime: null,
        aiTurnEndTime: null,
      }),
    }),

    recordFirstToken: assign({
      metrics: ({ context }) => {
        // Only record first token time once
        if (context.metrics.firstTokenTime !== null) return context.metrics;
        return {
          ...context.metrics,
          firstTokenTime: Date.now(),
        };
      },
    }),

    recordToken: assign({
      metrics: ({ context, event }) => {
        const tokenLength = event.type === "_llm:token" ? event.token.length : 0;
        return {
          ...context.metrics,
          currentTokenCount: context.metrics.currentTokenCount + 1,
          currentResponseLength: context.metrics.currentResponseLength + tokenLength,
        };
      },
    }),

    recordFirstSentence: assign({
      metrics: ({ context }) => {
        // Only record first sentence time once
        if (context.metrics.firstSentenceTime !== null) return context.metrics;
        return {
          ...context.metrics,
          firstSentenceTime: Date.now(),
        };
      },
    }),

    recordSentence: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        currentSentenceCount: context.metrics.currentSentenceCount + 1,
      }),
    }),

    recordFirstAudio: assign({
      metrics: ({ context }) => {
        // Only record first audio time once
        if (context.metrics.firstAudioTime !== null) return context.metrics;
        return {
          ...context.metrics,
          firstAudioTime: Date.now(),
        };
      },
    }),

    recordAudioChunk: assign({
      metrics: ({ context, event }) => {
        const samples = event.type === "_tts:chunk" ? event.audio.length : 0;
        return {
          ...context.metrics,
          currentAudioChunkCount: context.metrics.currentAudioChunkCount + 1,
          currentAudioSamples: context.metrics.currentAudioSamples + samples,
        };
      },
    }),

    recordAITurnComplete: assign({
      metrics: ({ context }) => {
        const aiTurnEndTime = Date.now();
        const m = context.metrics;

        // Calculate latencies
        const timeToFirstToken =
          m.firstTokenTime && m.aiTurnStartTime ? m.firstTokenTime - m.aiTurnStartTime : 0;
        const timeToFirstAudio =
          m.firstAudioTime && m.aiTurnStartTime ? m.firstAudioTime - m.aiTurnStartTime : 0;
        const turnDuration = m.aiTurnStartTime ? aiTurnEndTime - m.aiTurnStartTime : 0;

        // Calculate speaking duration (from first audio to turn end)
        const speakingDuration = m.firstAudioTime ? aiTurnEndTime - m.firstAudioTime : 0;

        return {
          ...m,
          aiTurnEndTime,
          completedTurns: m.completedTurns + 1,
          completedTurnsForAverage: m.completedTurnsForAverage + 1,
          totalTimeToFirstToken: m.totalTimeToFirstToken + timeToFirstToken,
          totalTimeToFirstAudio: m.totalTimeToFirstAudio + timeToFirstAudio,
          totalTurnDuration: m.totalTurnDuration + turnDuration,
          totalLLMTokens: m.totalLLMTokens + m.currentTokenCount,
          totalResponseChars: m.totalResponseChars + m.currentResponseLength,
          totalAgentSpeakingDuration: m.totalAgentSpeakingDuration + speakingDuration,
          totalAudioChunks: m.totalAudioChunks + m.currentAudioChunkCount,
          totalAudioSamples: m.totalAudioSamples + m.currentAudioSamples,
        };
      },
    }),

    recordAITurnInterrupted: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        interruptedTurns: context.metrics.interruptedTurns + 1,
      }),
    }),

    recordError: assign({
      metrics: ({ context, event }) => {
        let source: "stt" | "llm" | "tts" | "vad" = "stt";
        if (event.type === "_llm:error") source = "llm";
        else if (event.type === "_tts:error") source = "tts";

        return {
          ...context.metrics,
          errorsBySource: {
            ...context.metrics.errorsBySource,
            [source]: context.metrics.errorsBySource[source] + 1,
          },
        };
      },
    }),

    // Reset turn metrics for next turn
    resetTurnMetrics: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        humanTurnStartTime: null,
        humanTurnEndTime: null,
        humanSpeechDuration: 0,
        humanTranscriptLength: 0,
        aiTurnStartTime: null,
        firstTokenTime: null,
        firstSentenceTime: null,
        firstAudioTime: null,
        aiTurnEndTime: null,
        currentTokenCount: 0,
        currentSentenceCount: 0,
        currentResponseLength: 0,
        currentAudioChunkCount: 0,
        currentAudioSamples: 0,
      }),
    }),
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

export const agentMachine = agentMachineSetup.createMachine({
  id: "agent",
  initial: "idle",
  context: ({ input }) => createInitialContext(input.config, input.audioStreamController),

  states: {
    // ═══════════════════════════════════════════════════════════════════════
    // IDLE STATE
    // ═══════════════════════════════════════════════════════════════════════
    idle: {
      on: {
        "_agent:start": {
          target: "running",
          actions: [
            { type: "createAbortController" },
            { type: "recordSessionStart" },
            { type: "emitAgentStarted" },
          ],
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // RUNNING STATE (Parallel regions)
    // ═══════════════════════════════════════════════════════════════════════
    running: {
      type: "parallel",

      // Invoke persistent actors at the running state level
      invoke: [
        {
          id: "stt",
          src: "stt",
          systemId: "stt",
          input: ({ context }) => ({
            config: context.config,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
          }),
        },
        {
          id: "vad",
          src: "vad",
          systemId: "vad",
          input: ({ context }) => ({
            config: context.config,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
          }),
        },
        {
          id: "turnDetector",
          src: "turnDetector",
          systemId: "turnDetector",
          input: ({ context }) => ({
            config: context.config,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
          }),
        },
        {
          id: "audioStreamer",
          src: "audioStreamer",
          systemId: "audioStreamer",
          input: ({ context }) => ({
            audioStreamController: context.audioStreamController,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
          }),
        },
      ],

      // Global event handlers at running level
      on: {
        "_agent:stop": { target: "#agent.stopped" },

        // Audio input forwarding
        "_audio:input": {
          actions: [{ type: "forwardAudioToSTT" }, { type: "forwardAudioToVAD" }],
        },

        // Error handling - emit public error events
        "_stt:error": { actions: [{ type: "recordError" }, { type: "emitAgentError" }] },
        "_llm:error": { actions: [{ type: "recordError" }, { type: "emitAgentError" }] },
        "_tts:error": { actions: [{ type: "recordError" }, { type: "emitAgentError" }] },

        // Filler phrase control (internal only, not exposed to users)
        "_filler:say": {
          actions: [{ type: "setIsSpeaking" }, { type: "spawnTTSFromFiller" }],
        },
        "_filler:interrupt": {
          actions: [{ type: "stopTTS" }, { type: "clearIsSpeaking" }],
        },
      },

      states: {
        // ─────────────────────────────────────────────────────────────────────
        // LISTENING REGION: Handles user speech detection
        // ─────────────────────────────────────────────────────────────────────
        listening: {
          initial: "idle",

          on: {
            "_vad:speech-start": [
              {
                guard: "shouldBargeIn",
                target: ".userSpeaking",
                actions: [
                  { type: "recordAITurnInterrupted" },
                  { type: "emitAITurnInterrupted" },
                  { type: "stopLLM" },
                  { type: "stopTTS" },
                  { type: "abortCurrentController" },
                  { type: "createNewAbortController" },
                  { type: "clearDynamicActorRefs" },
                  { type: "clearIsSpeaking" },
                  { type: "clearAITurnHadAudio" },
                  { type: "resetTurnMetrics" },
                  { type: "setSpeechStartTime" },
                  { type: "recordHumanTurnStart" },
                  { type: "emitHumanTurnStarted" },
                ],
              },
              {
                guard: "hasVADAdapter",
                target: ".userSpeaking",
                actions: [
                  { type: "setSpeechStartTime" },
                  { type: "recordHumanTurnStart" },
                  { type: "emitHumanTurnStarted" },
                ],
              },
            ],
            "_stt:speech-start": [
              {
                guard: "canBargeInFromSTT",
                target: ".userSpeaking",
                actions: [
                  { type: "recordAITurnInterrupted" },
                  { type: "emitAITurnInterrupted" },
                  { type: "stopLLM" },
                  { type: "stopTTS" },
                  { type: "abortCurrentController" },
                  { type: "createNewAbortController" },
                  { type: "clearDynamicActorRefs" },
                  { type: "clearIsSpeaking" },
                  { type: "clearAITurnHadAudio" },
                  { type: "resetTurnMetrics" },
                  { type: "setSpeechStartTime" },
                  { type: "recordHumanTurnStart" },
                  { type: "emitHumanTurnStarted" },
                ],
              },
              {
                guard: "usesSTTForVAD",
                target: ".userSpeaking",
                actions: [
                  { type: "setSpeechStartTime" },
                  { type: "recordHumanTurnStart" },
                  { type: "emitHumanTurnStarted" },
                ],
              },
            ],
          },

          states: {
            idle: {},
            userSpeaking: {
              on: {
                "_vad:speech-end": {
                  guard: "hasVADAdapter",
                  target: "idle",
                  actions: [{ type: "clearSpeechStartTime" }, { type: "forwardToTurnDetector" }],
                },
                "_stt:speech-end": {
                  guard: "usesSTTForVAD",
                  target: "idle",
                  actions: [{ type: "clearSpeechStartTime" }, { type: "forwardToTurnDetector" }],
                },
              },
            },
          },
        },

        // ─────────────────────────────────────────────────────────────────────
        // TRANSCRIPTION REGION: Handles transcript events
        // ─────────────────────────────────────────────────────────────────────
        transcribing: {
          on: {
            "_stt:transcript": [
              {
                // Partial transcript - just emit and forward
                guard: ({ event }) => event.type === "_stt:transcript" && !event.isFinal,
                actions: [
                  { type: "emitHumanTurnTranscript" },
                  { type: "updatePartialTranscriptFromEvent" },
                  { type: "forwardToTurnDetector" },
                ],
              },
              {
                // Final transcript with turn detector - forward and wait
                guard: ({ event, context }) =>
                  event.type === "_stt:transcript" &&
                  event.isFinal &&
                  context.turnSource === "adapter",
                actions: [{ type: "emitHumanTurnTranscript" }, { type: "forwardToTurnDetector" }],
              },
              {
                // Final transcript without turn detector - this IS the turn end
                guard: ({ event, context }) =>
                  event.type === "_stt:transcript" && event.isFinal && context.turnSource === "stt",
                actions: [
                  { type: "recordHumanTurnEnd" },
                  { type: "emitHumanTurnTranscript" },
                  { type: "emitHumanTurnEnded" },
                  { type: "addUserMessageFromSTT" },
                  { type: "clearAITurnHadAudio" },
                  { type: "recordAITurnStart" },
                  { type: "emitAITurnStarted" },
                  { type: "spawnLLM" },
                ],
              },
            ],
            "_vad:probability": {
              actions: [{ type: "emitVADProbability" }],
            },
            "_turn:end": {
              actions: [
                { type: "recordHumanTurnEnd" },
                { type: "emitHumanTurnEnded" },
                { type: "addUserMessageFromTurnEnd" },
                { type: "clearAITurnHadAudio" },
                { type: "recordAITurnStart" },
                { type: "emitAITurnStarted" },
                { type: "spawnLLM" },
              ],
            },
            "_turn:abandoned": {
              actions: [{ type: "recordHumanTurnAbandoned" }, { type: "emitHumanTurnAbandoned" }],
            },
          },
        },

        // ─────────────────────────────────────────────────────────────────────
        // RESPONDING REGION: Handles LLM response generation
        // ─────────────────────────────────────────────────────────────────────
        responding: {
          initial: "idle",
          states: {
            idle: {},
            generating: {},
          },
          on: {
            "_llm:token": {
              actions: [
                { type: "recordFirstToken" },
                { type: "recordToken" },
                { type: "emitAITurnToken" },
                { type: "updateCurrentResponseFromEvent" },
              ],
            },
            "_llm:sentence": {
              actions: [
                { type: "recordFirstSentence" },
                { type: "recordSentence" },
                { type: "emitAITurnSentence" },
                { type: "setIsSpeaking" },
                { type: "spawnTTSFromSentence" },
              ],
            },
            "_llm:complete": [
              {
                // LLM complete but no audio was produced - emit turn end now
                guard: "aiTurnHadNoAudio",
                actions: [
                  { type: "recordAITurnComplete" },
                  { type: "emitAITurnEndedWithoutAudio" },
                  { type: "addAssistantMessageFromEvent" },
                  { type: "resetTurnMetrics" },
                ],
              },
              {
                // LLM complete with audio - wait for TTS to finish
                actions: [{ type: "addAssistantMessageFromEvent" }],
              },
            ],
          },
        },

        // ─────────────────────────────────────────────────────────────────────
        // STREAMING REGION: Handles audio synthesis and streaming
        // ─────────────────────────────────────────────────────────────────────
        streaming: {
          initial: "silent",
          states: {
            silent: {
              on: {
                "_tts:chunk": {
                  target: "streaming",
                  actions: [
                    { type: "setAITurnHadAudio" },
                    { type: "recordFirstAudio" },
                    { type: "recordAudioChunk" },
                    { type: "emitAITurnAudio" },
                    { type: "forwardAudioToStreamer" },
                  ],
                },
              },
            },
            streaming: {
              on: {
                "_tts:chunk": {
                  actions: [
                    { type: "recordAudioChunk" },
                    { type: "emitAITurnAudio" },
                    { type: "forwardAudioToStreamer" },
                  ],
                },
                "_tts:complete": {
                  target: "silent",
                  actions: [
                    { type: "recordAITurnComplete" },
                    { type: "clearIsSpeaking" },
                    { type: "emitAITurnEndedWithAudio" },
                    { type: "resetTurnMetrics" },
                  ],
                },
              },
            },
          },
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // STOPPED STATE (Final)
    // ═══════════════════════════════════════════════════════════════════════
    stopped: {
      entry: [{ type: "abortCurrentController" }, { type: "emitAgentStopped" }],
      type: "final",
    },
  },

  // Machine output when reaching final state
  output: ({ context }) => ({
    messages: context.messages,
    turnCount: context.messages.filter((m) => m.role === "user").length,
  }),
});

export type AgentMachine = typeof agentMachine;
