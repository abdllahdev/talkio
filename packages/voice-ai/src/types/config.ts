/**
 * Agent Configuration Types
 */

import type {
  LLMProvider,
  STTProvider,
  TTSProvider,
  TurnDetectorProvider,
  VADProvider,
} from "../providers/types";
import type { AgentEvent } from "./events";

/**
 * Audio format configuration.
 * Applies to both input and output audio throughout the pipeline.
 */
export interface AudioFormat {
  /**
   * Sample rate in Hz.
   * @default 24000
   */
  sampleRate: 8000 | 16000 | 22050 | 24000 | 44100 | 48000;

  /**
   * Number of audio channels.
   * @default 1 (mono)
   */
  channels: 1 | 2;

  /**
   * Bit depth for audio samples.
   * 16 = Int16Array, 32 = Float32Array
   * @default 32
   */
  bitDepth: 16 | 32;
}

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
 * Configuration for createAgent.
 */
export interface AgentConfig {
  /**
   * Speech-to-Text provider.
   */
  stt: STTProvider;

  /**
   * Language Model provider.
   */
  llm: LLMProvider;

  /**
   * Text-to-Speech provider.
   */
  tts: TTSProvider;

  /**
   * Voice Activity Detection provider.
   * If not provided, STT's built-in VAD is used as fallback.
   */
  vad?: VADProvider;

  /**
   * Turn Detector provider.
   * If not provided, STT's final transcript marks turn end.
   */
  turnDetector?: TurnDetectorProvider;

  /**
   * Barge-in (interruption) detection configuration.
   */
  bargeIn?: BargeInConfig;

  /**
   * Audio format configuration.
   * Providers will use this to know what format to produce/consume.
   * @default { sampleRate: 24000, channels: 1, bitDepth: 32 }
   */
  audioFormat?: AudioFormat;

  /**
   * Event handler callback.
   * Called for all agent events (observability only).
   */
  onEvent?: (event: AgentEvent) => void;
}
