/**
 * voice-ai
 *
 * A TypeScript package for building voice AI agents.
 * Provides orchestration for STT, LLM, TTS with support for
 * barge-in detection, turn management, and more.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export { createAgent } from "./agent/create-agent";
export type { Agent, AgentState } from "./agent/create-agent";

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  AssistantMessage,
  AudioPart,
  // Content parts
  ContentPart,
  FilePart,
  ImagePart,
  // Main message type
  Message,
  MessageContent,
  // Message variants
  SystemMessage,
  TextPart,
  ToolCallPart,
  ToolMessage,
  ToolResultPart,
  UserMessage,
} from "./types/common";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  Adapters,
  AgentBehaviorConfig,
  AgentConfig,
  BargeInConfig,
  OptionalAdapters,
  RequiredAdapters,
} from "./types/config";

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  // Main union type
  AgentEvent,
  // AI turn events
  AgentStartEvent,
  AgentStopEvent,
  AITurnEndEvent,
  AITurnEvent,
  AITurnInterruptedEvent,
  AITurnStartEvent,
  // Audio events
  AudioEvent,
  AudioInputChunkEvent,
  AudioOutputEndEvent,
  AudioOutputErrorEvent,
  AudioOutputStartEvent,
  AudioOutputStreamEvent,
  // Other events
  ControlEvent,
  HumanTurnEndEvent,
  HumanTurnEvent,
  // Human turn events
  HumanTurnStartEvent,
  // Individual Control events
  InterruptEvent,
  LLMCompleteEvent,
  LLMErrorEvent,
  LLMEvent,
  LLMSentenceEvent,
  // Individual LLM events
  LLMTokenEvent,
  SayEvent,
  STTErrorEvent,
  // Grouped event types
  STTEvent,
  STTSpeechEndEvent,
  STTSpeechStartEvent,
  STTTranscriptFinalEvent,
  // Individual STT events
  STTTranscriptPartialEvent,
  // Individual TTS events
  TTSChunkEvent,
  TTSCompleteEvent,
  TTSErrorEvent,
  TTSEvent,
  TurnAbandonedEvent,
  TurnDetectorEvent,
  // Individual Turn Detector events
  TurnEndEvent,
  VADEvent,
  VADProbabilityEvent,
  VADSpeechEndEvent,
  // Individual VAD events
  VADSpeechStartEvent,
} from "./types/events";

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTER INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  // Audio Output
  AudioStreamerAdapter,
  AudioStreamerContext,
  // LLM
  LLMAdapter,
  LLMContext,
  // STT
  STTAdapter,
  STTContext,
  // TTS
  TTSAdapter,
  TTSContext,
  // Turn Detector (optional)
  TurnDetectorAdapter,
  TurnDetectorContext,
  // VAD (optional)
  VADAdapter,
  VADContext,
} from "./adapters/types";
