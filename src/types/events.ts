/**
 * Agent Events
 *
 * All events used by the agent state machine.
 * Users can listen to any of these events via onEvent callback.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// STT EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface STTTranscriptPartialEvent {
  type: "stt-transcript-partial";
  text: string;
}

export interface STTTranscriptFinalEvent {
  type: "stt-transcript-final";
  text: string;
}

export interface STTSpeechStartEvent {
  type: "stt-speech-start";
}

export interface STTSpeechEndEvent {
  type: "stt-speech-end";
}

export interface STTErrorEvent {
  type: "stt-error";
  error: Error;
}

export type STTEvent =
  | STTTranscriptPartialEvent
  | STTTranscriptFinalEvent
  | STTSpeechStartEvent
  | STTSpeechEndEvent
  | STTErrorEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// LLM EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface LLMTokenEvent {
  type: "llm-token";
  token: string;
}

export interface LLMSentenceEvent {
  type: "llm-sentence";
  sentence: string;
  index: number;
}

export interface LLMCompleteEvent {
  type: "llm-complete";
  fullText: string;
}

export interface LLMErrorEvent {
  type: "llm-error";
  error: Error;
}

export type LLMEvent = LLMTokenEvent | LLMSentenceEvent | LLMCompleteEvent | LLMErrorEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// TTS EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface TTSChunkEvent {
  type: "tts-chunk";
  audio: Float32Array;
}

export interface TTSCompleteEvent {
  type: "tts-complete";
}

export interface TTSErrorEvent {
  type: "tts-error";
  error: Error;
}

export type TTSEvent = TTSChunkEvent | TTSCompleteEvent | TTSErrorEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// VAD EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface VADSpeechStartEvent {
  type: "vad-speech-start";
}

export interface VADSpeechEndEvent {
  type: "vad-speech-end";
  duration: number;
}

export interface VADProbabilityEvent {
  type: "vad-probability";
  value: number;
}

export type VADEvent = VADSpeechStartEvent | VADSpeechEndEvent | VADProbabilityEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// TURN DETECTOR EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface TurnEndEvent {
  type: "turn-end";
  transcript: string;
}

export interface TurnAbandonedEvent {
  type: "turn-abandoned";
  reason: string;
}

export type TurnDetectorEvent = TurnEndEvent | TurnAbandonedEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// HUMAN TURN EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface HumanTurnStartEvent {
  type: "human-turn-start";
}

export interface HumanTurnEndEvent {
  type: "human-turn-end";
  transcript: string;
}

export type HumanTurnEvent = HumanTurnStartEvent | HumanTurnEndEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// AI TURN EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface AITurnStartEvent {
  type: "ai-turn-start";
}

export interface AITurnEndEvent {
  type: "ai-turn-end";
}

export interface AITurnInterruptedEvent {
  type: "ai-turn-interrupted";
}

export type AITurnEvent = AITurnStartEvent | AITurnEndEvent | AITurnInterruptedEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Audio input (user → agent)
export interface AudioInputChunkEvent {
  type: "audio-input-chunk";
  audio: Float32Array;
}

// Audio output (agent → user)
export interface AudioOutputStartEvent {
  type: "audio-output-start";
}

export interface AudioOutputStreamEvent {
  type: "audio-output-stream";
  audio: Float32Array;
}

export interface AudioOutputEndEvent {
  type: "audio-output-end";
}

export interface AudioOutputErrorEvent {
  type: "audio-output-error";
  error: Error;
}

export type AudioEvent =
  | AudioInputChunkEvent
  | AudioOutputStartEvent
  | AudioOutputStreamEvent
  | AudioOutputEndEvent
  | AudioOutputErrorEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROL EVENTS (user-initiated or internal)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AgentStartEvent {
  type: "agent-start";
}

export interface AgentStopEvent {
  type: "agent-stop";
}

export interface SayEvent {
  type: "say";
  text: string;
}

export interface InterruptEvent {
  type: "interrupt";
}

export type ControlEvent = SayEvent | InterruptEvent;

// ═══════════════════════════════════════════════════════════════════════════════
// ALL AGENT EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentEvent =
  | AgentStartEvent
  | AgentStopEvent
  | STTEvent
  | LLMEvent
  | TTSEvent
  | VADEvent
  | TurnDetectorEvent
  | AudioEvent
  | ControlEvent
  | HumanTurnEvent
  | AITurnEvent;
