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

export type { AgentConfig, AudioFormat, BargeInConfig } from "./types/config";

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT TYPES
// Public events only - internal events are not exported
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  // Main union type (alias for PublicAgentEvent)
  AgentEvent,
  // Also export as PublicAgentEvent for clarity
  PublicAgentEvent,

  // Agent lifecycle events
  AgentLifecycleEvent,
  AgentStartedEvent,
  AgentStoppedEvent,
  AgentErrorEvent,

  // Human turn events
  HumanTurnEvent,
  HumanTurnStartedEvent,
  HumanTurnTranscriptEvent,
  HumanTurnEndedEvent,
  HumanTurnAbandonedEvent,

  // AI turn events
  AITurnEvent,
  AITurnStartedEvent,
  AITurnTokenEvent,
  AITurnSentenceEvent,
  AITurnAudioEvent,
  AITurnEndedEvent,
  AITurnInterruptedEvent,

  // Debug events
  DebugEvent,
  VADProbabilityEvent,
} from "./types/events";

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  // Turn-level metrics
  HumanTurnMetrics,
  AITurnMetrics,

  // Aggregate metrics (cumulative for session, via AgentState.metrics)
  AgentMetrics,
  SessionMetrics,
  TurnStatistics,
  LatencyMetrics,
  ContentMetrics,
  AudioMetrics,
  ErrorMetrics,
} from "./types/metrics";

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  // Base types
  BaseProvider,
  ProviderMetadata,
  ProviderType,
  // LLM
  LLMContext,
  LLMFunction,
  LLMInput,
  LLMProvider,
  // STT
  STTContext,
  STTProvider,
  // TTS
  TTSContext,
  TTSProvider,
  // Turn Detector (optional)
  TurnDetectorContext,
  TurnDetectorProvider,
  // VAD (optional)
  VADContext,
  VADProvider,
} from "./providers/types";

// Type guards (exported as values)
export { isLLMFunction, isLLMProvider } from "./providers/types";

// Provider factory functions
export {
  createCustomLLMProvider,
  createCustomSTTProvider,
  createCustomTTSProvider,
  createCustomTurnDetectorProvider,
  createCustomVADProvider,
} from "./providers/factories";

// Factory option types
export type {
  CreateCustomLLMProviderOptions,
  CreateCustomSTTProviderOptions,
  CreateCustomTTSProviderOptions,
  CreateCustomTurnDetectorProviderOptions,
  CreateCustomVADProviderOptions,
} from "./providers/factories";

// ═══════════════════════════════════════════════════════════════════════════════
// DEPRECATED ADAPTER ALIASES (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

/** @deprecated Use STTProvider instead */
export type { STTProvider as STTAdapter } from "./providers/types";
/** @deprecated Use LLMProvider instead */
export type { LLMProvider as LLMAdapter } from "./providers/types";
/** @deprecated Use TTSProvider instead */
export type { TTSProvider as TTSAdapter } from "./providers/types";
/** @deprecated Use VADProvider instead */
export type { VADProvider as VADAdapter } from "./providers/types";
/** @deprecated Use TurnDetectorProvider instead */
export type { TurnDetectorProvider as TurnDetectorAdapter } from "./providers/types";
