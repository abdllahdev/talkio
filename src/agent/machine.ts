/**
 * Agent State Machine
 *
 * This is the core XState machine that orchestrates the voice agent.
 * It manages turn-taking, barge-in detection, and coordination between
 * STT, LLM, TTS, and audio streamer.
 *
 * Architecture:
 * - Uses parallel states for independent concerns (listening, responding, streaming)
 * - Uses emit() for external event notification
 * - Uses invoke for persistent actors (STT, VAD, audio streamer)
 * - Uses spawn for dynamic actors (LLM, TTS per turn/sentence)
 *
 * Flow:
 * 1. User speaks → STT transcribes
 * 2. Turn ends → LLM generates response
 * 3. LLM streams sentences → TTS synthesizes each
 * 4. TTS produces audio → Audio output streams
 * 5. Audio streaming completes → AI turn ends
 */

import { nanoid } from "nanoid";
import { assign, emit, sendTo, setup } from "xstate";
import type { AgentMachineOutput } from "../types/common";
import type { ResolvedAgentConfig } from "../types/config";
import type { AgentEvent } from "../types/events";
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
    events: {} as AgentEvent,
    input: {} as { config: ResolvedAgentConfig },
    output: {} as AgentMachineOutput,
    emitted: {} as AgentEvent,
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
      if (!context.config.bargeIn.enabled || !context.isSpeaking) return false;
      if (event.type === "vad-speech-end") {
        return event.duration >= context.config.bargeIn.minDurationMs;
      }
      return true;
    },

    canBargeInFromSTT: ({ context }) =>
      context.vadSource === "stt" && context.config.bargeIn.enabled && context.isSpeaking,

    // Queue checks
    hasPendingSentences: ({ context }) => context.sentenceQueue.length > 0,

    // Speaking state
    isSpeaking: ({ context }) => context.isSpeaking,
    isNotSpeaking: ({ context }) => !context.isSpeaking,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  actions: {
    // ─────────────────────────────────────────────────────────────────────────
    // Event emitters (pass-through - emit the same events that come in)
    // ─────────────────────────────────────────────────────────────────────────
    emitEvent: emit(({ event }) => event as AgentEvent),

    // Derived turn events (emitted to consumers)
    emitTurnInterrupted: emit({ type: "ai-turn-interrupted" }),
    emitHumanTurnStart: emit({ type: "human-turn-start" }),
    emitHumanTurnEnd: emit(({ event }) => ({
      type: "human-turn-end" as const,
      transcript:
        event.type === "turn-end"
          ? event.transcript
          : event.type === "stt-transcript-final"
            ? event.text
            : "",
    })),
    emitAITurnStart: emit({ type: "ai-turn-start" }),
    emitAITurnEnd: emit({ type: "ai-turn-end" }),
    emitStopped: emit({ type: "agent-stop" }),

    // ─────────────────────────────────────────────────────────────────────────
    // Context mutations (pure assignments)
    // ─────────────────────────────────────────────────────────────────────────
    setSpeechStartTime: assign({ speechStartTime: () => Date.now() }),
    clearSpeechStartTime: assign({ speechStartTime: () => null }),

    updatePartialTranscriptFromEvent: assign({
      partialTranscript: ({ event }) => (event.type === "stt-transcript-partial" ? event.text : ""),
    }),

    clearPartialTranscript: assign({ partialTranscript: () => "" }),

    addUserMessageFromTurnEnd: assign({
      messages: ({ context, event }) => {
        const text = event.type === "turn-end" ? event.transcript : "";
        return [...context.messages, { role: "user" as const, content: text }];
      },
      partialTranscript: () => "",
    }),

    addUserMessageFromSTT: assign({
      messages: ({ context, event }) => {
        const text = event.type === "stt-transcript-final" ? event.text : "";
        return [...context.messages, { role: "user" as const, content: text }];
      },
      partialTranscript: () => "",
    }),

    addAssistantMessageFromEvent: assign({
      messages: ({ context, event }) => {
        const fullText = event.type === "llm-complete" ? event.fullText : "";
        return [...context.messages, { role: "assistant" as const, content: fullText }];
      },
      currentResponse: () => "",
      sentenceIndex: () => 0,
    }),

    updateCurrentResponseFromEvent: assign({
      currentResponse: ({ context, event }) => {
        const token = event.type === "llm-token" ? event.token : "";
        return context.currentResponse + token;
      },
    }),

    setIsSpeaking: assign({ isSpeaking: () => true }),
    clearIsSpeaking: assign({ isSpeaking: () => false }),

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
      if (event.type === "tts-chunk") {
        return { type: "audio-output-stream" as const, audio: event.audio };
      }
      return { type: "audio-output-stream" as const, audio: new Float32Array(0) };
    }),

    // ─────────────────────────────────────────────────────────────────────────
    // Adapter control (fire-and-forget side effects)
    // ─────────────────────────────────────────────────────────────────────────
    stopLLM: ({ context }) => {
      context.config.adapters.llm.cancel();
    },

    stopTTS: ({ context }) => {
      context.config.adapters.tts.cancel();
    },

    stopAudioStreamer: ({ context }) => {
      context.config.adapters.audioStreamer.stop();
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
            sayFn: (text: string) => self.send({ type: "say", text }),
            interruptFn: () => self.send({ type: "interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          },
        });
      },
    }),

    spawnTTSFromSentence: assign({
      ttsRef: ({ context, spawn, event, self }) => {
        const text = event.type === "llm-sentence" ? event.sentence : "";
        const signal = context.abortController?.signal ?? new AbortController().signal;
        return spawn("tts", {
          systemId: `currentTTS-${nanoid()}`,
          input: {
            config: context.config,
            text,
            abortSignal: signal,
            sayFn: (text: string) => self.send({ type: "say", text }),
            interruptFn: () => self.send({ type: "interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          },
        });
      },
    }),

    spawnTTSFromSay: assign({
      ttsRef: ({ context, spawn, event, self }) => {
        const text = event.type === "say" ? event.text : "";
        const signal = context.abortController?.signal ?? new AbortController().signal;
        return spawn("tts", {
          systemId: `currentTTS-${nanoid()}`,
          input: {
            config: context.config,
            text,
            abortSignal: signal,
            sayFn: (text: string) => self.send({ type: "say", text }),
            interruptFn: () => self.send({ type: "interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          },
        });
      },
    }),
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

export const agentMachine = agentMachineSetup.createMachine({
  id: "agent",
  initial: "idle",
  context: ({ input }) => createInitialContext(input.config),

  states: {
    // ═══════════════════════════════════════════════════════════════════════
    // IDLE STATE
    // ═══════════════════════════════════════════════════════════════════════
    idle: {
      on: {
        "agent-start": {
          target: "running",
          actions: [{ type: "createAbortController" }],
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
          input: ({ context, self }) => ({
            config: context.config,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
            sayFn: (text: string) => self.send({ type: "say", text }),
            interruptFn: () => self.send({ type: "interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          }),
        },
        {
          id: "vad",
          src: "vad",
          systemId: "vad",
          input: ({ context, self }) => ({
            config: context.config,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
            sayFn: (text: string) => self.send({ type: "say", text }),
            interruptFn: () => self.send({ type: "interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          }),
        },
        {
          id: "turnDetector",
          src: "turnDetector",
          systemId: "turnDetector",
          input: ({ context, self }) => ({
            config: context.config,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
            sayFn: (text: string) => self.send({ type: "say", text }),
            interruptFn: () => self.send({ type: "interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          }),
        },
        {
          id: "audioStreamer",
          src: "audioStreamer",
          systemId: "audioStreamer",
          input: ({ context, self }) => ({
            config: context.config,
            abortSignal: context.abortController?.signal ?? new AbortController().signal,
            sayFn: (text: string) => self.send({ type: "say", text }),
            interruptFn: () => self.send({ type: "interrupt" }),
            isSpeakingFn: () => context.isSpeaking,
          }),
        },
      ],

      // Global event handlers at running level
      on: {
        "agent-stop": { target: "#agent.stopped" },

        // Audio input forwarding
        "audio-input-chunk": {
          actions: [
            { type: "emitEvent" },
            { type: "forwardAudioToSTT" },
            { type: "forwardAudioToVAD" },
          ],
        },

        // Audio output events
        "audio-output-start": { actions: [{ type: "emitEvent" }] },

        // Error handling - pass through error events
        "stt-error": { actions: [{ type: "emitEvent" }] },
        "llm-error": { actions: [{ type: "emitEvent" }] },
        "tts-error": { actions: [{ type: "emitEvent" }] },
        "audio-output-error": { actions: [{ type: "emitEvent" }] },

        // Control events (from LLM ctx.say / ctx.interrupt)
        say: {
          actions: [{ type: "emitEvent" }, { type: "setIsSpeaking" }, { type: "spawnTTSFromSay" }],
        },
        interrupt: {
          actions: [
            { type: "stopTTS" },
            { type: "stopAudioStreamer" },
            { type: "clearIsSpeaking" },
          ],
        },
      },

      states: {
        // ─────────────────────────────────────────────────────────────────────
        // LISTENING REGION: Handles user speech detection
        // ─────────────────────────────────────────────────────────────────────
        listening: {
          initial: "idle",

          on: {
            "vad-speech-start": [
              {
                guard: "shouldBargeIn",
                target: ".userSpeaking",
                actions: [
                  { type: "emitTurnInterrupted" },
                  { type: "stopLLM" },
                  { type: "stopTTS" },
                  { type: "stopAudioStreamer" },
                  { type: "abortCurrentController" },
                  { type: "createNewAbortController" },
                  { type: "clearDynamicActorRefs" },
                  { type: "clearIsSpeaking" },
                  { type: "emitEvent" },
                  { type: "setSpeechStartTime" },
                  { type: "emitHumanTurnStart" },
                ],
              },
              {
                target: ".userSpeaking",
                actions: [
                  { type: "emitEvent" },
                  { type: "setSpeechStartTime" },
                  { type: "emitHumanTurnStart" },
                ],
              },
            ],
            "stt-speech-start": [
              {
                guard: "canBargeInFromSTT",
                target: ".userSpeaking",
                actions: [
                  { type: "emitTurnInterrupted" },
                  { type: "stopLLM" },
                  { type: "stopTTS" },
                  { type: "stopAudioStreamer" },
                  { type: "abortCurrentController" },
                  { type: "createNewAbortController" },
                  { type: "clearDynamicActorRefs" },
                  { type: "clearIsSpeaking" },
                  { type: "emitEvent" },
                  { type: "setSpeechStartTime" },
                  { type: "emitHumanTurnStart" },
                ],
              },
              {
                guard: "usesSTTForVAD",
                target: ".userSpeaking",
                actions: [
                  { type: "emitEvent" },
                  { type: "setSpeechStartTime" },
                  { type: "emitHumanTurnStart" },
                ],
              },
            ],
          },

          states: {
            idle: {},
            userSpeaking: {
              on: {
                "vad-speech-end": {
                  target: "idle",
                  actions: [
                    { type: "emitEvent" },
                    { type: "clearSpeechStartTime" },
                    { type: "forwardToTurnDetector" },
                  ],
                },
                "stt-speech-end": {
                  guard: "usesSTTForVAD",
                  target: "idle",
                  actions: [
                    { type: "emitEvent" },
                    { type: "clearSpeechStartTime" },
                    { type: "forwardToTurnDetector" },
                  ],
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
            "stt-transcript-partial": {
              actions: [
                { type: "emitEvent" },
                { type: "updatePartialTranscriptFromEvent" },
                { type: "forwardToTurnDetector" },
              ],
            },
            "stt-transcript-final": [
              {
                guard: "hasTurnDetector",
                actions: [{ type: "emitEvent" }, { type: "forwardToTurnDetector" }],
              },
              {
                // No turn detector → final transcript = turn end → trigger LLM
                actions: [
                  { type: "emitEvent" },
                  { type: "emitHumanTurnEnd" },
                  { type: "addUserMessageFromSTT" },
                  { type: "emitAITurnStart" },
                  { type: "spawnLLM" },
                ],
              },
            ],
            "vad-probability": {
              actions: [{ type: "emitEvent" }],
            },
            "turn-end": {
              actions: [
                { type: "emitEvent" },
                { type: "emitHumanTurnEnd" },
                { type: "addUserMessageFromTurnEnd" },
                { type: "emitAITurnStart" },
                { type: "spawnLLM" },
              ],
            },
            "turn-abandoned": {
              actions: [{ type: "emitEvent" }],
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
            "llm-token": {
              actions: [{ type: "emitEvent" }, { type: "updateCurrentResponseFromEvent" }],
            },
            "llm-sentence": {
              actions: [
                { type: "emitEvent" },
                { type: "setIsSpeaking" },
                { type: "spawnTTSFromSentence" },
              ],
            },
            "llm-complete": {
              actions: [{ type: "emitEvent" }, { type: "addAssistantMessageFromEvent" }],
            },
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
                "tts-chunk": {
                  target: "streaming",
                  actions: [{ type: "emitEvent" }, { type: "forwardAudioToStreamer" }],
                },
              },
            },
            streaming: {
              on: {
                "tts-chunk": {
                  actions: [{ type: "emitEvent" }, { type: "forwardAudioToStreamer" }],
                },
                "tts-complete": {
                  actions: [{ type: "emitEvent" }],
                },
                "audio-output-end": {
                  target: "silent",
                  actions: [
                    { type: "emitEvent" },
                    { type: "clearIsSpeaking" },
                    { type: "emitAITurnEnd" },
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
      entry: [{ type: "abortCurrentController" }, { type: "emitStopped" }],
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
