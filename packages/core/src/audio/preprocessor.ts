/**
 * Audio Preprocessor
 *
 * Normalizes audio from various input sources into a consistent format
 * expected by STT and VAD providers. Handles:
 * - Multiple input types (Blob, Float32Array, Int16Array, ArrayBuffer, Buffer)
 * - Format conversion (float32 → linear16, stereo → mono)
 * - Sample rate conversion (resampling)
 * - Decoding compressed formats (webm, opus)
 *
 * @module audio/preprocessor
 */

import {
  alawToLinear16,
  float32ToInt16,
  int16ToFloat32,
  mulawToLinear16,
  resampleInt16,
  stereoToMono,
} from "./conversions";
import { createAudioDecoder, requiresDecoding, type AudioDecoder } from "./decoder";
import type { AudioEncoding, Channels, NormalizedAudioFormat, SampleRate } from "./types";

/**
 * Audio input types that can be sent to the agent.
 *
 * Most types are converted synchronously:
 * - `ArrayBuffer` - Used directly
 * - `Float32Array` - Converted to ArrayBuffer (from AudioWorklet)
 * - `Int16Array` - Converted to ArrayBuffer (raw PCM samples)
 * - `Uint8Array` - Converted to ArrayBuffer
 * - `Buffer` - Node.js Buffer, converted to ArrayBuffer
 *
 * **Note**: `Blob` requires async conversion. Convert it first:
 * ```typescript
 * const buffer = await blob.arrayBuffer();
 * agent.sendAudio(buffer);
 * ```
 */
export type AudioInput = ArrayBuffer | Blob | Float32Array | Int16Array | Uint8Array | Buffer;

/**
 * Audio input configuration describing the format of incoming audio.
 */
export interface AudioInputConfig {
  /** Audio encoding format */
  encoding: AudioEncoding;
  /** Sample rate in Hz (required for raw PCM formats) */
  sampleRate?: SampleRate;
  /** Number of channels (1 = mono, 2 = stereo) */
  channels?: Channels;
}

/**
 * Audio preprocessor instance that normalizes audio to a target format.
 */
export interface AudioPreprocessor {
  /**
   * Process audio input and normalize to target format.
   *
   * @param input - Audio data in any supported format
   * @returns Normalized audio as ArrayBuffer in the target format
   */
  process(input: AudioInput): Promise<ArrayBuffer>;

  /**
   * Clean up preprocessor resources.
   */
  dispose(): void;
}

/**
 * Options for creating an audio preprocessor.
 */
export interface AudioPreprocessorOptions {
  /** Input audio configuration */
  inputConfig: AudioInputConfig;
  /** Target output format */
  targetFormat: NormalizedAudioFormat;
}

/**
 * Convert any AudioInput type to ArrayBuffer.
 */
async function toArrayBuffer(input: AudioInput): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) {
    return input;
  }

  if (input instanceof Blob) {
    return input.arrayBuffer();
  }

  if (input instanceof Float32Array || input instanceof Int16Array || input instanceof Uint8Array) {
    // Create a copy to ensure we have an ArrayBuffer
    const buffer = new ArrayBuffer(input.byteLength);
    new Uint8Array(buffer).set(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
    return buffer;
  }

  // Node.js Buffer - check for buffer-like object with necessary properties
  if (
    typeof input === "object" &&
    input !== null &&
    "buffer" in input &&
    "byteOffset" in input &&
    "byteLength" in input
  ) {
    const bufferLike = input as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
    return bufferLike.buffer.slice(
      bufferLike.byteOffset,
      bufferLike.byteOffset + bufferLike.byteLength,
    );
  }

  throw new Error(`Unsupported audio input type: ${typeof input}`);
}

/**
 * Convert raw PCM bytes to Int16Array based on encoding.
 */
function pcmToInt16(
  data: ArrayBuffer,
  encoding: AudioEncoding,
  channels: Channels,
): { samples: Int16Array; needsStereoToMono: boolean } {
  let samples: Int16Array;
  const needsStereoToMono = channels === 2;

  switch (encoding) {
    case "linear16": {
      samples = new Int16Array(data);
      break;
    }
    case "linear32": {
      const int32 = new Int32Array(data);
      samples = new Int16Array(int32.length);
      for (let i = 0; i < int32.length; i++) {
        // Scale 32-bit to 16-bit
        samples[i] = int32[i] >> 16;
      }
      break;
    }
    case "float32": {
      const float32 = new Float32Array(data);
      samples = float32ToInt16(float32);
      break;
    }
    case "mulaw": {
      const mulaw = new Uint8Array(data);
      samples = mulawToLinear16(mulaw);
      break;
    }
    case "alaw": {
      const alaw = new Uint8Array(data);
      samples = alawToLinear16(alaw);
      break;
    }
    default:
      throw new Error(`Unsupported PCM encoding: ${encoding}`);
  }

  return { samples, needsStereoToMono };
}

/**
 * Convert Int16Array to target encoding.
 */
function int16ToTargetEncoding(samples: Int16Array, encoding: AudioEncoding): ArrayBuffer {
  switch (encoding) {
    case "linear16": {
      const buffer = new ArrayBuffer(samples.byteLength);
      new Int16Array(buffer).set(samples);
      return buffer;
    }
    case "float32": {
      const float32 = int16ToFloat32(samples);
      const buffer = new ArrayBuffer(float32.byteLength);
      new Float32Array(buffer).set(float32);
      return buffer;
    }
    default:
      throw new Error(
        `Unsupported target encoding: ${encoding}. Only linear16 and float32 are supported as output.`,
      );
  }
}

/**
 * Create an audio preprocessor that normalizes audio to a target format.
 *
 * @param options - Preprocessor configuration
 * @returns AudioPreprocessor instance
 *
 * @example
 * ```typescript
 * const preprocessor = await createAudioPreprocessor({
 *   inputConfig: { encoding: "webm" },
 *   targetFormat: { encoding: "linear16", sampleRate: 16000, channels: 1 },
 * });
 *
 * // Process audio from MediaRecorder
 * mediaRecorder.ondataavailable = async (e) => {
 *   const normalized = await preprocessor.process(e.data);
 *   agent.sendAudio(normalized);
 * };
 * ```
 */
export async function createAudioPreprocessor(
  options: AudioPreprocessorOptions,
): Promise<AudioPreprocessor> {
  const { inputConfig, targetFormat } = options;

  // Create decoder for compressed formats
  let decoder: AudioDecoder | null = null;
  if (requiresDecoding(inputConfig.encoding)) {
    decoder = await createAudioDecoder({
      sampleRate: targetFormat.sampleRate,
      channels: targetFormat.channels,
    });

    if (!decoder.supports(inputConfig.encoding)) {
      throw new Error(
        `Encoding "${inputConfig.encoding}" requires decoding but no decoder is available. ` +
          `Install @discordjs/opus for opus/webm support.`,
      );
    }
  }

  // Determine input sample rate and channels (use defaults if not specified)
  const inputSampleRate = inputConfig.sampleRate ?? targetFormat.sampleRate;
  const inputChannels = inputConfig.channels ?? targetFormat.channels;

  // Warn if using defaults (helps catch configuration errors)
  if (inputConfig.sampleRate === undefined) {
    console.debug(
      `[audio/preprocessor] Input sample rate not specified, assuming target rate: ${targetFormat.sampleRate}Hz`,
    );
  }
  if (inputConfig.channels === undefined) {
    console.debug(
      `[audio/preprocessor] Input channels not specified, assuming target channels: ${targetFormat.channels}`,
    );
  }

  return {
    async process(input: AudioInput): Promise<ArrayBuffer> {
      // Step 1: Convert input to ArrayBuffer
      const arrayBuffer = await toArrayBuffer(input);

      // Step 2: Handle typed arrays that came with format info
      let samples: Int16Array;
      let currentSampleRate = inputSampleRate;
      let currentChannels = inputChannels;

      if (requiresDecoding(inputConfig.encoding) && decoder) {
        // Decode compressed audio
        const decoded = await decoder.decode(arrayBuffer, inputConfig.encoding);
        samples = decoded.samples;
        currentSampleRate = decoded.sampleRate as SampleRate;
        currentChannels = decoded.channels as Channels;
      } else {
        // Convert raw PCM to Int16
        const result = pcmToInt16(arrayBuffer, inputConfig.encoding, inputChannels);
        samples = result.samples;
        if (result.needsStereoToMono && targetFormat.channels === 1) {
          samples = stereoToMono(samples);
          currentChannels = 1;
        }
      }

      // Step 3: Convert stereo to mono if needed
      if (currentChannels === 2 && targetFormat.channels === 1) {
        samples = stereoToMono(samples);
      }

      // Step 4: Resample if needed
      if (currentSampleRate !== targetFormat.sampleRate) {
        samples = resampleInt16(samples, currentSampleRate, targetFormat.sampleRate);
      }

      // Step 5: Convert to target encoding
      return int16ToTargetEncoding(samples, targetFormat.encoding);
    },

    dispose(): void {
      decoder?.dispose();
    },
  };
}

/**
 * Check if an input type is a typed array (Float32Array, Int16Array, etc.).
 */
export function isTypedArray(input: AudioInput): input is Float32Array | Int16Array | Uint8Array {
  return (
    input instanceof Float32Array || input instanceof Int16Array || input instanceof Uint8Array
  );
}

/**
 * Infer encoding from typed array type.
 */
export function inferEncodingFromTypedArray(
  input: Float32Array | Int16Array | Uint8Array,
): AudioEncoding {
  if (input instanceof Float32Array) {
    return "float32";
  }
  if (input instanceof Int16Array) {
    return "linear16";
  }
  // Uint8Array could be mulaw, alaw, or raw bytes - default to linear16 interpretation
  return "linear16";
}
