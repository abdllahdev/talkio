/**
 * Agent State Machine
 *
 * Core XState machine that orchestrates the complete voice agent lifecycle.
 *
 * This machine coordinates all aspects of a voice conversation:
 * - **Lifecycle Management**: Starting/stopping providers, managing resources
 * - **Turn Management**: Detecting user turns, generating AI responses, handling interruptions
 * - **Interruption Detection**: Allowing users to interrupt the agent while speaking
 * - **Provider Coordination**: Orchestrating STT, LLM, TTS, VAD, and turn detector actors
 * - **Event Emission**: Translating internal machine events to public user-facing events
 * - **Metrics Tracking**: Collecting performance and usage metrics throughout the session
 * - **Error Handling**: Managing errors from providers and propagating them appropriately
 *
 * The machine uses a hierarchical state structure:
 * - `idle` - Initial state, agent not running
 * - `running` - Agent is active and processing
 *   - `listening` - Waiting for user input
 *   - `processing` - Generating response (LLM active)
 *   - `speaking` - Synthesizing speech (TTS active)
 *
 * State transitions are driven by events from providers and user actions.
 * The machine emits public events via the `onEvent` callback for observability.
 *
 * @module agent/machine
 */

import { nanoid } from "nanoid";
import { and, assign, emit, sendTo, setup } from "xstate";
import type { AgentMachineOutput } from "../types/common";
import type { NormalizedAgentConfig } from "../types/config";
import type { MachineEvent, PublicAgentEvent } from "../types/events";
import {
  audioStreamerActor,
  llmActor,
  sttActor,
  ttsActor,
  turnDetectorActor,
  vadActor,
} from "./actors";
import { type AgentMachineContext, createInitialContext } from "./context";
import { buildAITurnMetrics, buildHumanTurnMetrics, getTTSText } from "./helpers";

const agentMachineSetup = setup({
  types: {
    context: {} as AgentMachineContext,
    events: {} as MachineEvent,
    input: {} as {
      config: NormalizedAgentConfig;
      audioStreamController: ReadableStreamDefaultController<ArrayBuffer> | null;
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

  guards: {
    // VAD/Turn source guards
    hasVADAdapter: ({ context }) => context.vadSource === "adapter",
    usesSTTForVAD: ({ context }) => context.vadSource === "stt",
    hasTurnDetector: ({ context }) => context.turnSource === "adapter",
    noTurnDetector: ({ context }) => context.turnSource === "stt",

    // Atomic guards for composition
    interruptionEnabled: ({ context }) => context.config.interruption?.enabled ?? false,
    isSpeaking: ({ context }) => context.isSpeaking,
    isNotSpeaking: ({ context }) => !context.isSpeaking,
    sufficientDuration: ({ context, event }) => {
      if (event.type !== "_vad:speech-end") return true;
      return event.duration >= (context.config.interruption?.minDurationMs ?? 0);
    },

    // Composed interruption guards
    shouldInterrupt: and(["interruptionEnabled", "isSpeaking", "sufficientDuration"]),
    canInterruptFromSTT: and(["usesSTTForVAD", "interruptionEnabled", "isSpeaking"]),

    // Queue/TTS guards
    hasPendingSentences: ({ context }) => context.sentenceQueue.length > 0,
    hasPendingTTS: ({ context }) => context.pendingTTSCount > 0,
    noPendingTTS: ({ context }) => context.pendingTTSCount === 0,
    canSpawnNextTTS: ({ context }) => context.sentenceQueue.length > 0 && context.ttsRef === null,

    // Turn state guards
    aiTurnHadAudio: ({ context }) => context.aiTurnHadAudio,
    aiTurnHadNoAudio: ({ context }) => !context.aiTurnHadAudio,
    humanTurnNotStarted: ({ context }) => !context.humanTurnStarted,
  },

  actions: {
    // Emit actions
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
      return {
        type: "human-turn:ended" as const,
        transcript,
        metrics: buildHumanTurnMetrics(context.metrics),
      };
    }),
    emitHumanTurnAbandoned: emit(({ event }) => {
      const reason = event.type === "_turn:abandoned" ? event.reason : "unknown";
      return { type: "human-turn:abandoned" as const, reason };
    }),
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
      const audio = event.type === "_tts:chunk" ? event.audio : new ArrayBuffer(0);
      return { type: "ai-turn:audio" as const, audio };
    }),
    emitAITurnEnded: emit(({ context }) => ({
      type: "ai-turn:ended" as const,
      text: context.lastLLMResponse,
      wasSpoken: context.aiTurnHadAudio,
      metrics: buildAITurnMetrics(context.metrics),
    })),
    emitAITurnInterrupted: emit(({ context }) => ({
      type: "ai-turn:interrupted" as const,
      partialText: context.currentResponse,
      metrics: buildAITurnMetrics(context.metrics, true),
    })),

    // Debug events
    emitVADProbability: emit(({ event }) => {
      const value = event.type === "_vad:probability" ? event.value : 0;
      return { type: "vad:probability" as const, value };
    }),

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
    setAITurnHadAudio: assign({ aiTurnHadAudio: () => true }),
    clearAITurnHadAudio: assign({ aiTurnHadAudio: () => false }),
    setHumanTurnStarted: assign({ humanTurnStarted: () => true }),
    clearHumanTurnStarted: assign({ humanTurnStarted: () => false }),
    createSessionAbortController: assign({ sessionAbortController: () => new AbortController() }),
    createTurnAbortController: assign({ turnAbortController: () => new AbortController() }),

    abortTurnController: ({ context }) => {
      context.turnAbortController?.abort();
    },

    abortSessionController: ({ context }) => {
      context.sessionAbortController?.abort();
    },

    createNewTurnAbortController: assign({
      turnAbortController: () => new AbortController(),
    }),

    clearDynamicActorRefs: assign({
      llmRef: () => null,
      ttsRef: () => null,
      sentenceQueue: () => [],
      pendingTTSCount: () => 0,
    }),
    debugLogEvent: ({ context, event }) => {
      if (context.config.debug) {
        console.log("[machine] Event:", event.type);
      }
    },
    forwardAudioToSTT: sendTo("stt", ({ event }) => event),
    forwardAudioToVAD: sendTo("vad", ({ event }) => event),
    forwardToTurnDetector: sendTo("turnDetector", ({ event }) => event),
    forwardAudioToStreamer: sendTo("audioStreamer", ({ event }) => {
      if (event.type === "_tts:chunk") {
        return { type: "_audio:output-chunk" as const, audio: event.audio };
      }
      return { type: "_audio:output-chunk" as const, audio: new Float32Array(0) };
    }),
    spawnLLM: assign({
      llmRef: ({ context, spawn, self }) => {
        const signal = context.turnAbortController?.signal ?? new AbortController().signal;
        return spawn("llm", {
          input: {
            config: context.config,
            messages: context.messages,
            abortSignal: signal,
            sayFn: (text: string) => self.send({ type: "_filler:say", text }),
            interruptFn: () => self.send({ type: "_filler:interrupt" }),
            isSpeakingFn: () => self.getSnapshot().context.isSpeaking,
          },
        });
      },
    }),

    queueSentence: assign({
      sentenceQueue: ({ context, event }) => {
        const text = event.type === "_llm:sentence" ? event.sentence : "";
        return [...context.sentenceQueue, text];
      },
      pendingTTSCount: ({ context }) => context.pendingTTSCount + 1,
    }),

    spawnTTSFromQueue: assign({
      ttsRef: ({ context, spawn }) => {
        const text = getTTSText("queue", context.sentenceQueue, { type: "" });
        if (!text) return null;
        const signal = context.turnAbortController?.signal ?? new AbortController().signal;
        return spawn("tts", {
          systemId: `currentTTS-${nanoid()}`,
          input: { config: context.config, text, abortSignal: signal },
        });
      },
      sentenceQueue: ({ context }) => context.sentenceQueue.slice(1),
    }),

    clearTTSRef: assign({ ttsRef: () => null }),

    decrementPendingTTS: assign({
      pendingTTSCount: ({ context }) => Math.max(0, context.pendingTTSCount - 1),
    }),

    spawnTTSFromFiller: assign({
      ttsRef: ({ context, spawn, event }) => {
        const text = getTTSText("filler", [], event);
        if (!text) return null;
        const signal = context.turnAbortController?.signal ?? new AbortController().signal;
        return spawn("tts", {
          systemId: `currentTTS-${nanoid()}`,
          input: { config: context.config, text, abortSignal: signal },
        });
      },
    }),
    recordSessionStart: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        sessionStartedAt: Date.now(),
      }),
    }),
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
        let speechDuration = context.metrics.humanSpeechDuration;
        if (event.type === "_vad:speech-end") {
          speechDuration = event.duration;
        } else if (context.metrics.humanTurnStartTime) {
          speechDuration = humanTurnEndTime - context.metrics.humanTurnStartTime;
        }

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
    recordAITurnStart: assign({
      metrics: ({ context }) => ({
        ...context.metrics,
        aiTurnStartTime: Date.now(),
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
        if (context.metrics.firstAudioTime !== null) return context.metrics;
        return {
          ...context.metrics,
          firstAudioTime: Date.now(),
        };
      },
    }),

    recordAudioChunk: assign({
      metrics: ({ context, event }) => {
        const bytes = event.type === "_tts:chunk" ? event.audio.byteLength : 0;
        return {
          ...context.metrics,
          currentAudioChunkCount: context.metrics.currentAudioChunkCount + 1,
          currentAudioSamples: context.metrics.currentAudioSamples + bytes,
        };
      },
    }),

    recordAITurnComplete: assign({
      metrics: ({ context }) => {
        const aiTurnEndTime = Date.now();
        const m = context.metrics;
        const timeToFirstToken =
          m.firstTokenTime && m.aiTurnStartTime ? m.firstTokenTime - m.aiTurnStartTime : 0;
        const timeToFirstAudio =
          m.firstAudioTime && m.aiTurnStartTime ? m.firstAudioTime - m.aiTurnStartTime : 0;
        const turnDuration = m.aiTurnStartTime ? aiTurnEndTime - m.aiTurnStartTime : 0;
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

export const agentMachine = agentMachineSetup.createMachine({
  id: "agent",
  initial: "idle",
  context: ({ input }) => createInitialContext(input.config, input.audioStreamController),

  states: {
    idle: {
      on: {
        "_agent:start": {
          target: "running",
          actions: [
            { type: "createSessionAbortController" },
            { type: "createTurnAbortController" },
            { type: "recordSessionStart" },
            { type: "emitAgentStarted" },
          ],
        },
      },
    },
    running: {
      type: "parallel",
      invoke: [
        {
          id: "stt",
          src: "stt",
          systemId: "stt",
          input: ({ context }) => ({
            config: context.config,
            abortSignal: context.sessionAbortController?.signal ?? new AbortController().signal,
          }),
        },
        {
          id: "vad",
          src: "vad",
          systemId: "vad",
          input: ({ context }) => ({
            config: context.config,
            abortSignal: context.sessionAbortController?.signal ?? new AbortController().signal,
          }),
        },
        {
          id: "turnDetector",
          src: "turnDetector",
          systemId: "turnDetector",
          input: ({ context }) => ({
            config: context.config,
            abortSignal: context.sessionAbortController?.signal ?? new AbortController().signal,
          }),
        },
        {
          id: "audioStreamer",
          src: "audioStreamer",
          systemId: "audioStreamer",
          input: ({ context }) => ({
            audioStreamController: context.audioStreamController,
            abortSignal: context.sessionAbortController?.signal ?? new AbortController().signal,
          }),
        },
      ],
      on: {
        "_agent:stop": { target: "#agent.stopped" },
        "_audio:input": {
          actions: [
            { type: "debugLogEvent" },
            { type: "forwardAudioToSTT" },
            { type: "forwardAudioToVAD" },
          ],
        },
        "_stt:error": {
          actions: [{ type: "debugLogEvent" }, { type: "recordError" }, { type: "emitAgentError" }],
        },
        "_llm:error": {
          actions: [{ type: "debugLogEvent" }, { type: "recordError" }, { type: "emitAgentError" }],
        },
        "_tts:error": {
          actions: [{ type: "debugLogEvent" }, { type: "recordError" }, { type: "emitAgentError" }],
        },
        "_filler:say": {
          actions: [{ type: "setIsSpeaking" }, { type: "spawnTTSFromFiller" }],
        },
        "_filler:interrupt": {
          actions: [
            { type: "abortTurnController" },
            { type: "createNewTurnAbortController" },
            { type: "clearDynamicActorRefs" },
            { type: "clearIsSpeaking" },
          ],
        },
      },
      states: {
        listening: {
          initial: "idle",

          on: {
            "_vad:speech-start": [
              {
                guard: "shouldInterrupt",
                target: ".userSpeaking",
                actions: [
                  { type: "debugLogEvent" },
                  { type: "recordAITurnInterrupted" },
                  { type: "emitAITurnInterrupted" },
                  { type: "abortTurnController" },
                  { type: "createNewTurnAbortController" },
                  { type: "clearDynamicActorRefs" },
                  { type: "clearIsSpeaking" },
                  { type: "clearAITurnHadAudio" },
                  { type: "resetTurnMetrics" },
                  { type: "recordHumanTurnStart" },
                  { type: "setHumanTurnStarted" },
                  { type: "emitHumanTurnStarted" },
                ],
              },
              {
                guard: "hasVADAdapter",
                target: ".userSpeaking",
                actions: [
                  { type: "debugLogEvent" },
                  { type: "recordHumanTurnStart" },
                  { type: "setHumanTurnStarted" },
                  { type: "emitHumanTurnStarted" },
                ],
              },
            ],
            "_stt:speech-start": [
              {
                guard: "canInterruptFromSTT",
                target: ".userSpeaking",
                actions: [
                  { type: "debugLogEvent" },
                  { type: "recordAITurnInterrupted" },
                  { type: "emitAITurnInterrupted" },
                  { type: "abortTurnController" },
                  { type: "createNewTurnAbortController" },
                  { type: "clearDynamicActorRefs" },
                  { type: "clearIsSpeaking" },
                  { type: "clearAITurnHadAudio" },
                  { type: "resetTurnMetrics" },
                  { type: "recordHumanTurnStart" },
                  { type: "setHumanTurnStarted" },
                  { type: "emitHumanTurnStarted" },
                ],
              },
              {
                guard: "usesSTTForVAD",
                target: ".userSpeaking",
                actions: [{ type: "debugLogEvent" }, { type: "recordHumanTurnStart" }],
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
                  actions: [{ type: "forwardToTurnDetector" }],
                },
                "_stt:speech-end": {
                  guard: "usesSTTForVAD",
                  target: "idle",
                  actions: [{ type: "forwardToTurnDetector" }],
                },
              },
            },
          },
        },
        transcribing: {
          on: {
            "_stt:transcript": [
              {
                guard: ({ event, context }) =>
                  event.type === "_stt:transcript" && !event.isFinal && !context.humanTurnStarted,
                actions: [
                  { type: "setHumanTurnStarted" },
                  { type: "emitHumanTurnStarted" },
                  { type: "debugLogEvent" },
                  { type: "emitHumanTurnTranscript" },
                  { type: "updatePartialTranscriptFromEvent" },
                  { type: "forwardToTurnDetector" },
                ],
              },
              {
                guard: ({ event }) => event.type === "_stt:transcript" && !event.isFinal,
                actions: [
                  { type: "debugLogEvent" },
                  { type: "emitHumanTurnTranscript" },
                  { type: "updatePartialTranscriptFromEvent" },
                  { type: "forwardToTurnDetector" },
                ],
              },
              {
                guard: ({ event, context }) =>
                  event.type === "_stt:transcript" &&
                  event.isFinal &&
                  !context.humanTurnStarted &&
                  context.turnSource === "adapter",
                actions: [
                  { type: "setHumanTurnStarted" },
                  { type: "emitHumanTurnStarted" },
                  { type: "debugLogEvent" },
                  { type: "emitHumanTurnTranscript" },
                  { type: "forwardToTurnDetector" },
                ],
              },
              {
                guard: ({ event, context }) =>
                  event.type === "_stt:transcript" &&
                  event.isFinal &&
                  context.turnSource === "adapter",
                actions: [
                  { type: "debugLogEvent" },
                  { type: "emitHumanTurnTranscript" },
                  { type: "forwardToTurnDetector" },
                ],
              },
              {
                guard: ({ event, context }) =>
                  event.type === "_stt:transcript" &&
                  event.isFinal &&
                  !context.humanTurnStarted &&
                  context.turnSource === "stt",
                actions: [
                  { type: "setHumanTurnStarted" },
                  { type: "emitHumanTurnStarted" },
                  { type: "debugLogEvent" },
                  { type: "recordHumanTurnEnd" },
                  { type: "emitHumanTurnTranscript" },
                  { type: "emitHumanTurnEnded" },
                  { type: "addUserMessageFromSTT" },
                  { type: "clearAITurnHadAudio" },
                  { type: "clearHumanTurnStarted" },
                  { type: "recordAITurnStart" },
                  { type: "emitAITurnStarted" },
                  { type: "spawnLLM" },
                ],
              },
              {
                guard: ({ event, context }) =>
                  event.type === "_stt:transcript" && event.isFinal && context.turnSource === "stt",
                actions: [
                  { type: "debugLogEvent" },
                  { type: "recordHumanTurnEnd" },
                  { type: "emitHumanTurnTranscript" },
                  { type: "emitHumanTurnEnded" },
                  { type: "addUserMessageFromSTT" },
                  { type: "clearAITurnHadAudio" },
                  { type: "clearHumanTurnStarted" },
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
                { type: "clearHumanTurnStarted" },
                { type: "recordAITurnStart" },
                { type: "emitAITurnStarted" },
                { type: "spawnLLM" },
              ],
            },
            "_turn:abandoned": {
              actions: [
                { type: "recordHumanTurnAbandoned" },
                { type: "emitHumanTurnAbandoned" },
                { type: "clearHumanTurnStarted" },
              ],
            },
          },
        },
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
            "_llm:sentence": [
              {
                guard: ({ context }) => context.ttsRef === null,
                actions: [
                  { type: "recordFirstSentence" },
                  { type: "recordSentence" },
                  { type: "emitAITurnSentence" },
                  { type: "setIsSpeaking" },
                  { type: "queueSentence" },
                  { type: "spawnTTSFromQueue" },
                ],
              },
              {
                actions: [
                  { type: "recordFirstSentence" },
                  { type: "recordSentence" },
                  { type: "emitAITurnSentence" },
                  { type: "queueSentence" },
                ],
              },
            ],
            "_llm:complete": [
              {
                guard: "aiTurnHadNoAudio",
                actions: [
                  { type: "recordAITurnComplete" },
                  { type: "emitAITurnEnded" },
                  { type: "addAssistantMessageFromEvent" },
                  { type: "resetTurnMetrics" },
                ],
              },
              {
                actions: [{ type: "addAssistantMessageFromEvent" }],
              },
            ],
          },
        },
        streaming: {
          initial: "silent",
          states: {
            silent: {
              on: {
                "_tts:chunk": {
                  guard: "isSpeaking",
                  target: "streaming",
                  actions: [
                    { type: "setAITurnHadAudio" },
                    { type: "recordFirstAudio" },
                    { type: "recordAudioChunk" },
                    { type: "emitAITurnAudio" },
                    { type: "forwardAudioToStreamer" },
                  ],
                },
                "_tts:complete": [
                  {
                    guard: "hasPendingSentences",
                    actions: [
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "spawnTTSFromQueue" },
                    ],
                  },
                  {
                    actions: [
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "clearIsSpeaking" },
                    ],
                  },
                ],
                "_tts:error": [
                  {
                    guard: "hasPendingSentences",
                    actions: [
                      { type: "debugLogEvent" },
                      { type: "recordError" },
                      { type: "emitAgentError" },
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "spawnTTSFromQueue" },
                    ],
                  },
                  {
                    actions: [
                      { type: "debugLogEvent" },
                      { type: "recordError" },
                      { type: "emitAgentError" },
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "clearIsSpeaking" },
                    ],
                  },
                ],
              },
            },
            streaming: {
              on: {
                "_tts:chunk": {
                  guard: "isSpeaking",
                  actions: [
                    { type: "recordAudioChunk" },
                    { type: "emitAITurnAudio" },
                    { type: "forwardAudioToStreamer" },
                  ],
                },
                "_tts:complete": [
                  {
                    guard: "hasPendingSentences",
                    actions: [
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "spawnTTSFromQueue" },
                    ],
                  },
                  {
                    target: "silent",
                    actions: [
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "recordAITurnComplete" },
                      { type: "clearIsSpeaking" },
                      { type: "emitAITurnEnded" },
                      { type: "resetTurnMetrics" },
                    ],
                  },
                ],
                "_tts:error": [
                  {
                    guard: "hasPendingSentences",
                    actions: [
                      { type: "debugLogEvent" },
                      { type: "recordError" },
                      { type: "emitAgentError" },
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "spawnTTSFromQueue" },
                    ],
                  },
                  {
                    target: "silent",
                    actions: [
                      { type: "debugLogEvent" },
                      { type: "recordError" },
                      { type: "emitAgentError" },
                      { type: "clearTTSRef" },
                      { type: "decrementPendingTTS" },
                      { type: "recordAITurnComplete" },
                      { type: "clearIsSpeaking" },
                      { type: "emitAITurnEnded" },
                      { type: "resetTurnMetrics" },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    stopped: {
      entry: [{ type: "abortSessionController" }, { type: "emitAgentStopped" }],
      type: "final",
    },
  },
  output: ({ context }) => ({
    messages: context.messages,
    turnCount: context.messages.filter((m) => m.role === "user").length,
  }),
});

export type AgentMachine = typeof agentMachine;
