/**
 * Agent Machine Context
 *
 * Defines the context type and initial context factory for the agent state machine.
 */

import type { ActorRefFrom } from "xstate";
import type { Message } from "../types/common";
import type { AgentConfig } from "../types/config";
import { type MetricsTrackingState, createInitialMetricsState } from "../types/metrics";
import type { llmActor, ttsActor } from "./actors";

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentMachineContext {
  config: AgentConfig;
  messages: Message[];
  partialTranscript: string;
  currentResponse: string;
  sentenceIndex: number;
  isSpeaking: boolean;
  speechStartTime: number | null;
  abortController: AbortController | null;

  // Dynamic actor refs (spawned per turn/sentence, stored for lifecycle control)
  llmRef: ActorRefFrom<typeof llmActor> | null;
  ttsRef: ActorRefFrom<typeof ttsActor> | null;

  // Queue of sentences waiting for TTS
  sentenceQueue: string[];

  // Event source flags
  vadSource: "adapter" | "stt";
  turnSource: "adapter" | "stt";

  // Audio output stream controller (for pushing audio chunks to ReadableStream)
  audioStreamController: ReadableStreamDefaultController<Float32Array> | null;

  // AI turn tracking (for proper turn end emission)
  aiTurnHadAudio: boolean;
  lastLLMResponse: string;

  // Metrics tracking state
  metrics: MetricsTrackingState;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL CONTEXT FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createInitialContext(
  config: AgentConfig,
  audioStreamController: ReadableStreamDefaultController<Float32Array> | null,
): AgentMachineContext {
  return {
    config,
    messages: [],
    partialTranscript: "",
    currentResponse: "",
    sentenceIndex: 0,
    isSpeaking: false,
    speechStartTime: null,
    abortController: null,
    llmRef: null,
    ttsRef: null,
    sentenceQueue: [],
    vadSource: config.vad ? "adapter" : "stt",
    turnSource: config.turnDetector ? "adapter" : "stt",
    audioStreamController,
    aiTurnHadAudio: false,
    lastLLMResponse: "",
    metrics: createInitialMetricsState(),
  };
}
