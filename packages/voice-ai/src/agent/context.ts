/**
 * Agent Machine Context
 *
 * Defines the context type and initial context factory for the agent state machine.
 *
 * The context holds all the mutable state that the agent machine needs to track:
 * - Configuration (normalized audio config, providers)
 * - Conversation state (messages, partial transcript, current response)
 * - Turn state (sentence index, speaking status, speech timing)
 * - Actor references (LLM, TTS actors for coordination)
 * - Audio streaming (ReadableStream controller for output)
 * - Metrics tracking (internal state for computing metrics)
 *
 * The context is updated via XState `assign` actions as the machine transitions
 * through different states. The initial context is created with default values
 * and the provided configuration.
 *
 * @module agent/context
 */

import type { ActorRefFrom } from "xstate";
import type { AudioFormat } from "../audio/types";
import type { Message } from "../types/common";
import type { NormalizedAgentConfig } from "../types/config";
import { type MetricsTrackingState, createInitialMetricsState } from "../types/metrics";
import type { llmActor, ttsActor } from "./actors";

export interface AgentMachineContext {
  config: NormalizedAgentConfig;
  messages: Message[];
  partialTranscript: string;
  currentResponse: string;
  sentenceIndex: number;
  isSpeaking: boolean;
  speechStartTime: number | null;
  sessionAbortController: AbortController | null;
  turnAbortController: AbortController | null;

  llmRef: ActorRefFrom<typeof llmActor> | null;
  ttsRef: ActorRefFrom<typeof ttsActor> | null;
  sentenceQueue: string[];
  vadSource: "adapter" | "stt";
  turnSource: "adapter" | "stt";
  audioStreamController: ReadableStreamDefaultController<ArrayBuffer> | null;
  aiTurnHadAudio: boolean;
  lastLLMResponse: string;
  metrics: MetricsTrackingState;
  llmComplete: boolean;
  pendingTTSCount: number;
  silencePromptCount: number;
  hasUserSpoken: boolean;
  humanTurnStarted: boolean;
}

export function createInitialContext<
  InputFormat extends AudioFormat,
  OutputFormat extends AudioFormat,
>(
  config: NormalizedAgentConfig<InputFormat, OutputFormat>,
  audioStreamController: ReadableStreamDefaultController<ArrayBuffer> | null,
): AgentMachineContext {
  return {
    config,
    messages: [],
    partialTranscript: "",
    currentResponse: "",
    sentenceIndex: 0,
    isSpeaking: false,
    speechStartTime: null,
    sessionAbortController: null,
    turnAbortController: null,
    llmRef: null,
    ttsRef: null,
    sentenceQueue: [],
    vadSource: config.vad ? "adapter" : "stt",
    turnSource: config.turnDetector ? "adapter" : "stt",
    audioStreamController,
    aiTurnHadAudio: false,
    lastLLMResponse: "",
    metrics: createInitialMetricsState(),
    llmComplete: false,
    pendingTTSCount: 0,
    silencePromptCount: 0,
    hasUserSpoken: false,
    humanTurnStarted: false,
  };
}
