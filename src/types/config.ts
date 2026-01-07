/**
 * Agent Configuration Types
 */

import type {
  AudioStreamerAdapter,
  LLMAdapter,
  STTAdapter,
  TTSAdapter,
  TurnDetectorAdapter,
  VADAdapter,
} from "../adapters/types";
import type { AgentEvent } from "./events";

/**
 * Required adapters that must be provided.
 */
export interface RequiredAdapters {
  /** Speech-to-Text adapter */
  stt: STTAdapter;
  /** Language Model adapter */
  llm: LLMAdapter;
  /** Text-to-Speech adapter */
  tts: TTSAdapter;
  /** Audio Output adapter */
  audioStreamer: AudioStreamerAdapter;
}

/**
 * Optional adapters that enhance functionality.
 */
export interface OptionalAdapters {
  /**
   * Voice Activity Detection adapter.
   * If not provided, STT's built-in VAD is used as fallback.
   */
  vad?: VADAdapter;

  /**
   * Turn Detector adapter.
   * If not provided, STT's final transcript marks turn end.
   */
  turnDetector?: TurnDetectorAdapter;
}

/**
 * All adapters (required + optional).
 */
export type Adapters = RequiredAdapters & OptionalAdapters;

/**
 * Barge-in configuration.
 */
export interface BargeInConfig {
  /**
   * Whether barge-in detection is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Minimum speech duration (ms) before treating as barge-in.
   * Helps filter out noise and accidental sounds.
   * @default 200
   */
  minDurationMs?: number;
}

/**
 * Agent behavior configuration.
 */
export interface AgentBehaviorConfig {
  /**
   * Barge-in (interruption) detection configuration.
   */
  bargeIn?: BargeInConfig;
}

/**
 * Configuration for createAgent.
 */
export interface AgentConfig {
  /**
   * User-provided adapters.
   */
  adapters: Adapters;

  /**
   * Agent behavior configuration.
   */
  config?: AgentBehaviorConfig;

  /**
   * Event handler callback.
   * Called for all agent events (observability only).
   */
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Resolved configuration with defaults applied.
 */
export interface ResolvedAgentConfig {
  adapters: Adapters;
  bargeIn: Required<BargeInConfig>;
  onEvent: (event: AgentEvent) => void;
}

/**
 * Apply default values to agent configuration.
 */
export function resolveConfig(config: AgentConfig): ResolvedAgentConfig {
  return {
    adapters: config.adapters,
    bargeIn: {
      enabled: config.config?.bargeIn?.enabled ?? true,
      minDurationMs: config.config?.bargeIn?.minDurationMs ?? 200,
    },
    onEvent: config.onEvent ?? (() => {}),
  };
}
