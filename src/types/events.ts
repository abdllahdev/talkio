/**
 * Agent Events
 *
 * Two-layer event architecture:
 * - Public events: Semantic, user-facing events exposed via onEvent callback
 * - Internal events: Machine-only events prefixed with "_", not exposed to users
 */

import type { AITurnMetrics, HumanTurnMetrics } from "./metrics";

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC EVENTS (Exposed via onEvent callback)
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Agent Lifecycle Events
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentStartedEvent {
  type: "agent:started";
}

export interface AgentStoppedEvent {
  type: "agent:stopped";
}

export interface AgentErrorEvent {
  type: "agent:error";
  error: Error;
  source: "stt" | "llm" | "tts" | "vad";
}

export type AgentLifecycleEvent = AgentStartedEvent | AgentStoppedEvent | AgentErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Human Turn Events
// ─────────────────────────────────────────────────────────────────────────────

export interface HumanTurnStartedEvent {
  type: "human-turn:started";
}

export interface HumanTurnTranscriptEvent {
  type: "human-turn:transcript";
  text: string;
  isFinal: boolean;
}

export interface HumanTurnEndedEvent {
  type: "human-turn:ended";
  transcript: string;
  metrics: HumanTurnMetrics;
}

export interface HumanTurnAbandonedEvent {
  type: "human-turn:abandoned";
  reason: string;
}

export type HumanTurnEvent =
  | HumanTurnStartedEvent
  | HumanTurnTranscriptEvent
  | HumanTurnEndedEvent
  | HumanTurnAbandonedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// AI Turn Events
// ─────────────────────────────────────────────────────────────────────────────

export interface AITurnStartedEvent {
  type: "ai-turn:started";
}

export interface AITurnTokenEvent {
  type: "ai-turn:token";
  token: string;
}

export interface AITurnSentenceEvent {
  type: "ai-turn:sentence";
  sentence: string;
  index: number;
}

export interface AITurnAudioEvent {
  type: "ai-turn:audio";
  audio: Float32Array;
}

export interface AITurnEndedEvent {
  type: "ai-turn:ended";
  text: string;
  wasSpoken: boolean;
  metrics: AITurnMetrics;
}

export interface AITurnInterruptedEvent {
  type: "ai-turn:interrupted";
  partialText: string;
  metrics: AITurnMetrics;
}

export type AITurnEvent =
  | AITurnStartedEvent
  | AITurnTokenEvent
  | AITurnSentenceEvent
  | AITurnAudioEvent
  | AITurnEndedEvent
  | AITurnInterruptedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Debug Events (optional, for observability)
// ─────────────────────────────────────────────────────────────────────────────

export interface VADProbabilityEvent {
  type: "vad:probability";
  value: number;
}

export type DebugEvent = VADProbabilityEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Public Event Union (exported as AgentEvent for users)
// ─────────────────────────────────────────────────────────────────────────────

export type PublicAgentEvent = AgentLifecycleEvent | HumanTurnEvent | AITurnEvent | DebugEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL EVENTS (Machine use only, not exposed to users)
// All internal events are prefixed with "_" for clear distinction
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Audio Input (from user to machine)
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalAudioInputEvent {
  type: "_audio:input";
  audio: Float32Array;
}

// ─────────────────────────────────────────────────────────────────────────────
// STT Internal Events
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalSTTTranscriptEvent {
  type: "_stt:transcript";
  text: string;
  isFinal: boolean;
}

export interface InternalSTTSpeechStartEvent {
  type: "_stt:speech-start";
}

export interface InternalSTTSpeechEndEvent {
  type: "_stt:speech-end";
}

export interface InternalSTTErrorEvent {
  type: "_stt:error";
  error: Error;
}

export type InternalSTTEvent =
  | InternalSTTTranscriptEvent
  | InternalSTTSpeechStartEvent
  | InternalSTTSpeechEndEvent
  | InternalSTTErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
// VAD Internal Events
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalVADSpeechStartEvent {
  type: "_vad:speech-start";
}

export interface InternalVADSpeechEndEvent {
  type: "_vad:speech-end";
  duration: number;
}

export interface InternalVADProbabilityEvent {
  type: "_vad:probability";
  value: number;
}

export type InternalVADEvent =
  | InternalVADSpeechStartEvent
  | InternalVADSpeechEndEvent
  | InternalVADProbabilityEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Turn Detector Internal Events
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalTurnEndEvent {
  type: "_turn:end";
  transcript: string;
}

export interface InternalTurnAbandonedEvent {
  type: "_turn:abandoned";
  reason: string;
}

export type InternalTurnDetectorEvent = InternalTurnEndEvent | InternalTurnAbandonedEvent;

// ─────────────────────────────────────────────────────────────────────────────
// LLM Internal Events
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalLLMTokenEvent {
  type: "_llm:token";
  token: string;
}

export interface InternalLLMSentenceEvent {
  type: "_llm:sentence";
  sentence: string;
  index: number;
}

export interface InternalLLMCompleteEvent {
  type: "_llm:complete";
  fullText: string;
}

export interface InternalLLMErrorEvent {
  type: "_llm:error";
  error: Error;
}

export type InternalLLMEvent =
  | InternalLLMTokenEvent
  | InternalLLMSentenceEvent
  | InternalLLMCompleteEvent
  | InternalLLMErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
// TTS Internal Events
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalTTSChunkEvent {
  type: "_tts:chunk";
  audio: Float32Array;
}

export interface InternalTTSCompleteEvent {
  type: "_tts:complete";
}

export interface InternalTTSErrorEvent {
  type: "_tts:error";
  error: Error;
}

export type InternalTTSEvent =
  | InternalTTSChunkEvent
  | InternalTTSCompleteEvent
  | InternalTTSErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Filler Control Internal Events (from LLM ctx.say / ctx.interrupt)
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalFillerSayEvent {
  type: "_filler:say";
  text: string;
}

export interface InternalFillerInterruptEvent {
  type: "_filler:interrupt";
}

export type InternalFillerEvent = InternalFillerSayEvent | InternalFillerInterruptEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Audio Output Internal Events (from streamer actor)
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalAudioOutputStartEvent {
  type: "_audio:output-start";
}

export interface InternalAudioOutputChunkEvent {
  type: "_audio:output-chunk";
  audio: Float32Array;
}

export interface InternalAudioOutputEndEvent {
  type: "_audio:output-end";
}

export interface InternalAudioOutputErrorEvent {
  type: "_audio:output-error";
  error: Error;
}

export type InternalAudioOutputEvent =
  | InternalAudioOutputStartEvent
  | InternalAudioOutputChunkEvent
  | InternalAudioOutputEndEvent
  | InternalAudioOutputErrorEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Agent Control Internal Events
// ─────────────────────────────────────────────────────────────────────────────

export interface InternalAgentStartEvent {
  type: "_agent:start";
}

export interface InternalAgentStopEvent {
  type: "_agent:stop";
}

export type InternalAgentControlEvent = InternalAgentStartEvent | InternalAgentStopEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Internal Event Union
// ─────────────────────────────────────────────────────────────────────────────

export type InternalAgentEvent =
  | InternalAudioInputEvent
  | InternalSTTEvent
  | InternalVADEvent
  | InternalTurnDetectorEvent
  | InternalLLMEvent
  | InternalTTSEvent
  | InternalFillerEvent
  | InternalAudioOutputEvent
  | InternalAgentControlEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// MACHINE EVENT TYPE (Internal use only - union of public and internal)
// ═══════════════════════════════════════════════════════════════════════════════

export type MachineEvent = PublicAgentEvent | InternalAgentEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED TYPE ALIAS (for backwards compatibility and user-facing API)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * User-facing agent event type.
 * Only includes public events - internal events are filtered out.
 */
export type AgentEvent = PublicAgentEvent;
