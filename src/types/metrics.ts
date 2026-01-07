/**
 * Agent Metrics Types
 *
 * Defines types for observability metrics exposed via events and AgentState.
 *
 * Architecture:
 * - TurnMetrics: Per-turn metrics emitted via `metrics:turn` event
 * - AgentMetrics: Aggregate session metrics exposed via AgentState.metrics
 * - MetricsTrackingState: Internal machine context for tracking timestamps/counters
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TURN-LEVEL METRICS (emitted per turn via metrics:turn event)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Metrics for a single human turn.
 */
export interface HumanTurnMetrics {
  /** Duration of user speech in milliseconds */
  speechDuration: number;
  /** Character count of the final transcript */
  transcriptLength: number;
}

/**
 * Metrics for a single AI turn.
 */
export interface AITurnMetrics {
  /** Time from AI turn start to first LLM token (ms) */
  timeToFirstToken: number;
  /** Time from first token to first complete sentence (ms) */
  timeToFirstSentence: number;
  /** Time from first sentence to first TTS audio chunk (ms) */
  timeToFirstAudio: number;
  /** Total duration from AI turn start to AI turn end (ms) */
  totalDuration: number;
  /** Number of tokens generated */
  tokenCount: number;
  /** Number of sentences in response */
  sentenceCount: number;
  /** Character count of the response */
  responseLength: number;
  /** Number of TTS audio chunks produced */
  audioChunkCount: number;
  /** Total audio samples synthesized */
  totalAudioSamples: number;
  /** Whether this turn was interrupted by user */
  wasInterrupted: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATE METRICS (cumulative for session, exposed via AgentState.metrics)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Session timing metrics.
 */
export interface SessionMetrics {
  /** Unix timestamp when agent started */
  startedAt: number;
  /** Current session duration in milliseconds */
  duration: number;
}

/**
 * Turn statistics.
 */
export interface TurnStatistics {
  /** Total number of turns */
  total: number;
  /** Number of turns completed successfully */
  completed: number;
  /** Number of turns interrupted by user (barge-in) */
  interrupted: number;
  /** Number of turns abandoned by turn detector */
  abandoned: number;
}

/**
 * Aggregate latency metrics (averages across all completed turns).
 */
export interface LatencyMetrics {
  /** Average time to first LLM token (ms) */
  averageTimeToFirstToken: number;
  /** Average time to first TTS audio (ms) */
  averageTimeToFirstAudio: number;
  /** Average total turn duration (ms) */
  averageTurnDuration: number;
}

/**
 * Aggregate content metrics (totals across all turns).
 */
export interface ContentMetrics {
  /** Total LLM tokens generated */
  totalLLMTokens: number;
  /** Total characters in user transcripts */
  totalUserTranscriptChars: number;
  /** Total characters in AI responses */
  totalResponseChars: number;
}

/**
 * Aggregate audio metrics (totals across all turns).
 */
export interface AudioMetrics {
  /** Total user speech duration (ms) */
  totalUserSpeechDuration: number;
  /** Total agent speaking duration (ms) */
  totalAgentSpeakingDuration: number;
  /** Total TTS audio chunks */
  totalAudioChunks: number;
  /** Total audio samples synthesized */
  totalAudioSamples: number;
}

/**
 * Error tracking metrics.
 */
export interface ErrorMetrics {
  /** Total error count */
  total: number;
  /** Errors grouped by source */
  bySource: Record<"stt" | "llm" | "tts" | "vad", number>;
}

/**
 * Complete aggregate metrics exposed via AgentState.metrics.
 * Provides cumulative session statistics.
 */
export interface AgentMetrics {
  /** Session timing */
  session: SessionMetrics;
  /** Turn statistics */
  turns: TurnStatistics;
  /** Latency averages */
  latency: LatencyMetrics;
  /** Content totals */
  content: ContentMetrics;
  /** Audio totals */
  audio: AudioMetrics;
  /** Error tracking */
  errors: ErrorMetrics;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL METRICS TRACKING (machine context only, not exported to users)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal metrics state tracked in machine context.
 * Used to calculate turn-level and aggregate metrics.
 * Not exposed to users directly.
 */
export interface MetricsTrackingState {
  // Session
  sessionStartedAt: number | null;

  // Current turn timestamps
  humanTurnStartTime: number | null;
  humanTurnEndTime: number | null;
  humanSpeechDuration: number;
  humanTranscriptLength: number;

  // AI turn timestamps
  aiTurnStartTime: number | null;
  firstTokenTime: number | null;
  firstSentenceTime: number | null;
  firstAudioTime: number | null;
  aiTurnEndTime: number | null;

  // Current turn counters
  currentTokenCount: number;
  currentSentenceCount: number;
  currentResponseLength: number;
  currentAudioChunkCount: number;
  currentAudioSamples: number;

  // Aggregate totals (for calculating averages)
  totalTimeToFirstToken: number;
  totalTimeToFirstAudio: number;
  totalTurnDuration: number;
  completedTurnsForAverage: number;

  // Aggregate counters
  totalTurns: number;
  completedTurns: number;
  interruptedTurns: number;
  abandonedTurns: number;
  totalLLMTokens: number;
  totalUserTranscriptChars: number;
  totalResponseChars: number;
  totalUserSpeechDuration: number;
  totalAgentSpeakingDuration: number;
  totalAudioChunks: number;
  totalAudioSamples: number;
  errorsBySource: Record<"stt" | "llm" | "tts" | "vad", number>;
}

/**
 * Creates the initial metrics tracking state.
 */
export function createInitialMetricsState(): MetricsTrackingState {
  return {
    sessionStartedAt: null,
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
    totalTimeToFirstToken: 0,
    totalTimeToFirstAudio: 0,
    totalTurnDuration: 0,
    completedTurnsForAverage: 0,
    totalTurns: 0,
    completedTurns: 0,
    interruptedTurns: 0,
    abandonedTurns: 0,
    totalLLMTokens: 0,
    totalUserTranscriptChars: 0,
    totalResponseChars: 0,
    totalUserSpeechDuration: 0,
    totalAgentSpeakingDuration: 0,
    totalAudioChunks: 0,
    totalAudioSamples: 0,
    errorsBySource: { stt: 0, llm: 0, tts: 0, vad: 0 },
  };
}
