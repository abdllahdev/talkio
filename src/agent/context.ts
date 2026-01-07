/**
 * Agent Machine Context
 *
 * Defines the context type and initial context factory for the agent state machine.
 */

import type { ActorRefFrom } from "xstate";
import type { Message } from "../types/common";
import type { ResolvedAgentConfig } from "../types/config";
import type { llmActor, ttsActor } from "./actors";

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentMachineContext {
  config: ResolvedAgentConfig;
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL CONTEXT FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function createInitialContext(config: ResolvedAgentConfig): AgentMachineContext {
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
    vadSource: config.adapters.vad ? "adapter" : "stt",
    turnSource: config.adapters.turnDetector ? "adapter" : "stt",
  };
}
