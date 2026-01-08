/**
 * Audio Module
 *
 * Public API for audio format types and utilities.
 *
 * This module re-exports all audio-related types and functions from the
 * internal types module, providing a clean public API for audio configuration.
 *
 * **Exports**:
 * - Type definitions: `AudioFormat`, `AudioEncoding`, `AudioConfig`, etc.
 * - Normalization functions: `normalizeFormat()`, `normalizeAudioConfig()`
 * - Default configurations: `DEFAULT_AUDIO_FORMAT`, `DEFAULT_AUDIO_CONFIG`
 *
 * Use this module when you need to work with audio formats in your application,
 * such as when configuring the agent's audio input/output or when creating
 * custom providers that need to validate audio formats.
 *
 * @module audio
 */

export type {
  AudioConfig,
  AudioEncoding,
  AudioFormat,
  Channels,
  CompressedEncoding,
  ContainerEncoding,
  NormalizedAudioConfig,
  NormalizedAudioFormat,
  PCMEncoding,
  SampleRate,
  TelephonyEncoding,
} from "./types";

export {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_AUDIO_FORMAT,
  normalizeAudioConfig,
  normalizeFormat,
} from "./types";
