/**
 * Audio Types
 *
 * Defines the audio format type system with encoding-based defaults.
 *
 * This module provides a comprehensive type system for audio configuration:
 * - Audio encodings (PCM, telephony, compressed, container formats)
 * - Sample rates and channel counts
 * - Audio format interfaces with optional fields
 * - Normalization functions that apply encoding defaults
 * - Default configurations for common use cases
 *
 * **Key Features**:
 * - Only `encoding` is required in `AudioFormat` - `sampleRate` and `channels` default based on encoding
 * - `normalizeFormat()` applies defaults to create a fully-specified format
 * - Supports a wide range of encodings from raw PCM to compressed formats
 * - Type-safe format validation at compile time
 *
 * **Common Encodings**:
 * - `linear16` - 16-bit PCM (most common, recommended for voice)
 * - `mulaw` / `alaw` - Telephony encodings (G.711 standard)
 * - `opus` - Low-latency compressed codec
 * - `wav` - Waveform container format
 *
 * The audio format system ensures type safety and provides sensible defaults
 * while allowing fine-grained control when needed.
 *
 * @module audio/types
 */

/**
 * PCM (Pulse Code Modulation) encodings - uncompressed raw audio.
 *
 * - `linear16` - 16-bit signed little-endian PCM (most common, recommended)
 * - `linear32` - 32-bit signed little-endian PCM
 * - `float32` - 32-bit floating-point PCM
 */
export type PCMEncoding = "linear16" | "linear32" | "float32";

/**
 * Telephony encodings - G.711 standard for voice calls.
 *
 * - `mulaw` - Mu-law encoding (North America, Japan)
 * - `alaw` - A-law encoding (Europe, rest of world)
 */
export type TelephonyEncoding = "mulaw" | "alaw";

/**
 * Compressed audio encodings.
 *
 * - `opus` - Opus codec (low latency, high quality)
 * - `ogg-opus` - Opus in Ogg container
 * - `flac` - Free Lossless Audio Codec
 * - `mp3` - MPEG Audio Layer III
 * - `aac` - Advanced Audio Coding
 * - `speex` - Speex speech codec
 * - `amr-nb` - Adaptive multi-rate narrow band
 * - `amr-wb` - Adaptive multi-rate wide band
 * - `g729` - G.729 telephony codec
 */
export type CompressedEncoding =
  | "opus"
  | "ogg-opus"
  | "flac"
  | "mp3"
  | "aac"
  | "speex"
  | "amr-nb"
  | "amr-wb"
  | "g729";

/**
 * Container format encodings.
 *
 * These formats include both audio codec and container metadata.
 * - `wav` - Waveform Audio File Format
 * - `webm` - WebM container (typically with Opus or Vorbis)
 * - `ogg` - Ogg container (typically with Vorbis)
 * - `mp4` - MPEG-4 container (typically with AAC)
 */
export type ContainerEncoding = "wav" | "webm" | "ogg" | "mp4";

/**
 * All supported audio encodings.
 *
 * The encoding determines the audio format, and each encoding has default
 * sample rates and channel counts that are applied if not specified.
 */
export type AudioEncoding =
  | PCMEncoding
  | TelephonyEncoding
  | CompressedEncoding
  | ContainerEncoding;

/**
 * Common sample rates in Hz (Hertz).
 *
 * Higher sample rates provide better audio quality but require more bandwidth.
 * Common choices:
 * - 8000 Hz - Telephony quality
 * - 16000 Hz - Voice quality (common for STT)
 * - 24000 Hz - High-quality voice (common for TTS)
 * - 44100 Hz - CD quality
 * - 48000 Hz - Professional audio
 */
export type SampleRate = 8000 | 16000 | 22050 | 24000 | 32000 | 44100 | 48000;

/**
 * Channel count (mono or stereo).
 *
 * - `1` - Mono (single channel, recommended for voice)
 * - `2` - Stereo (two channels, left and right)
 */
export type Channels = 1 | 2;

/**
 * Default sample rate and channels for each encoding.
 */
const ENCODING_DEFAULTS: Record<AudioEncoding, { sampleRate: SampleRate; channels: Channels }> = {
  // PCM encodings
  linear16: { sampleRate: 16000, channels: 1 },
  linear32: { sampleRate: 48000, channels: 1 },
  float32: { sampleRate: 48000, channels: 1 },

  // Telephony encodings (G.711 standard)
  mulaw: { sampleRate: 8000, channels: 1 },
  alaw: { sampleRate: 8000, channels: 1 },

  // Compressed encodings
  opus: { sampleRate: 48000, channels: 1 },
  "ogg-opus": { sampleRate: 48000, channels: 1 },
  flac: { sampleRate: 48000, channels: 2 },
  mp3: { sampleRate: 44100, channels: 2 },
  aac: { sampleRate: 44100, channels: 2 },
  speex: { sampleRate: 16000, channels: 1 },
  "amr-nb": { sampleRate: 8000, channels: 1 },
  "amr-wb": { sampleRate: 16000, channels: 1 },
  g729: { sampleRate: 8000, channels: 1 },

  // Container formats
  wav: { sampleRate: 44100, channels: 2 },
  webm: { sampleRate: 48000, channels: 2 },
  ogg: { sampleRate: 48000, channels: 2 },
  mp4: { sampleRate: 44100, channels: 2 },
};

/**
 * Audio format configuration.
 *
 * Only `encoding` is required. If `sampleRate` or `channels` are omitted,
 * they default to the encoding's standard values (see encoding defaults).
 *
 * @example Minimal format (uses encoding defaults)
 * ```typescript
 * // Uses defaults for linear16: 16000 Hz, mono
 * const format: AudioFormat = { encoding: "linear16" };
 * ```
 *
 * @example Explicit format
 * ```typescript
 * const format: AudioFormat = {
 *   encoding: "linear16",
 *   sampleRate: 24000,
 *   channels: 1,
 * };
 * ```
 */
export interface AudioFormat {
  /** Audio encoding (required) */
  encoding: AudioEncoding;
  /** Sample rate in Hz (optional, defaults based on encoding) */
  sampleRate?: SampleRate;
  /** Channel count: 1 for mono, 2 for stereo (optional, defaults based on encoding) */
  channels?: Channels;
}

/**
 * Normalized audio format with all fields required.
 *
 * Used internally after applying encoding defaults. All fields are guaranteed
 * to be defined, making it safe to use without null checks.
 */
export interface NormalizedAudioFormat {
  /** Audio encoding */
  encoding: AudioEncoding;
  /** Sample rate in Hz (always defined after normalization) */
  sampleRate: SampleRate;
  /** Channel count (always defined after normalization) */
  channels: Channels;
}

/**
 * Normalize an AudioFormat by applying encoding defaults for missing fields.
 *
 * If `sampleRate` or `channels` are not specified, they are set to the
 * default values for the given encoding.
 *
 * @param format - Audio format to normalize
 * @returns Normalized format with all fields defined
 *
 * @example
 * ```typescript
 * const format = { encoding: "linear16" };
 * const normalized = normalizeFormat(format);
 * // normalized = { encoding: "linear16", sampleRate: 16000, channels: 1 }
 * ```
 */
export function normalizeFormat(format: AudioFormat): NormalizedAudioFormat {
  const defaults = ENCODING_DEFAULTS[format.encoding];
  return {
    encoding: format.encoding,
    sampleRate: format.sampleRate ?? defaults.sampleRate,
    channels: format.channels ?? defaults.channels,
  };
}

/**
 * Default audio format: linear16 at 24kHz mono.
 *
 * This is a high-quality format suitable for most voice AI applications.
 * Used as a fallback when no audio configuration is provided.
 */
export const DEFAULT_AUDIO_FORMAT: NormalizedAudioFormat = {
  encoding: "linear16",
  sampleRate: 24000,
  channels: 1,
};

/**
 * Audio configuration with separate input and output formats.
 *
 * Allows different formats for input (STT) and output (TTS), which is useful
 * when providers have different optimal formats or when you need to match
 * specific hardware requirements.
 *
 * At least one of `input` or `output` must be specified. Both are optional,
 * allowing you to override just the input format (STT) or just the output format (TTS).
 * When omitted, the provider's defaults are used.
 *
 * Generic over input and output format types to enable compile-time validation
 * that the audio configuration matches the provider's supported formats.
 *
 * @typeParam InputFormat - The input format type (constrained by STT provider)
 * @typeParam OutputFormat - The output format type (constrained by TTS provider)
 *
 * @example Input only
 * ```typescript
 * const audioConfig: AudioConfig = {
 *   input: { encoding: "linear16", sampleRate: 16000 },  // Override STT input
 * };
 * ```
 *
 * @example Output only
 * ```typescript
 * const audioConfig: AudioConfig = {
 *   output: { encoding: "linear16", sampleRate: 24000 }, // Override TTS output
 * };
 * ```
 *
 * @example Both
 * ```typescript
 * const audioConfig: AudioConfig = {
 *   input: { encoding: "linear16", sampleRate: 16000 },  // STT input
 *   output: { encoding: "linear16", sampleRate: 24000 }, // TTS output
 * };
 * ```
 */
export type AudioConfig<
  InputFormat extends AudioFormat = AudioFormat,
  OutputFormat extends AudioFormat = AudioFormat,
> =
  | { input: InputFormat; output: OutputFormat }
  | { input: InputFormat; output?: undefined }
  | { input?: undefined; output: OutputFormat };

/**
 * Normalized audio configuration with all format fields required.
 *
 * Used internally after applying encoding defaults. Both input and output
 * formats have all fields (encoding, sampleRate, channels) defined.
 */
export interface NormalizedAudioConfig {
  /** Normalized input format (all fields defined) */
  input: NormalizedAudioFormat;
  /** Normalized output format (all fields defined) */
  output: NormalizedAudioFormat;
}

/**
 * Normalize an AudioConfig by applying encoding defaults to both input and output formats.
 *
 * Both input and output formats must be provided (not undefined).
 * To handle partial configs with provider defaults, use the nullish coalescing operator
 * to fill in missing values before calling this function.
 *
 * @param config - Audio configuration to normalize (both input and output must be defined)
 * @returns Normalized configuration with all format fields defined
 *
 * @example
 * ```typescript
 * const normalized = normalizeAudioConfig({
 *   input: { encoding: "linear16", sampleRate: 16000 },
 *   output: { encoding: "linear16", sampleRate: 24000 },
 * });
 * ```
 */
export function normalizeAudioConfig(config: {
  input: AudioFormat;
  output: AudioFormat;
}): NormalizedAudioConfig {
  return {
    input: normalizeFormat(config.input),
    output: normalizeFormat(config.output),
  };
}

/**
 * Default audio configuration.
 *
 * Uses the default audio format (linear16 at 24kHz mono) for both input and output.
 * Used as a fallback when no audio configuration is provided.
 */
export const DEFAULT_AUDIO_CONFIG: NormalizedAudioConfig = {
  input: DEFAULT_AUDIO_FORMAT,
  output: DEFAULT_AUDIO_FORMAT,
};
