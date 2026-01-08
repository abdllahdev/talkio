/**
 * Provider Factory Functions
 *
 * Helper functions for creating custom provider implementations.
 * These simplify the process of building providers by handling
 * metadata construction and providing sensible defaults.
 */

import type { Message } from "../types/common";
import type {
  LLMContext,
  LLMProvider,
  STTContext,
  STTProvider,
  TTSContext,
  TTSProvider,
  TurnDetectorContext,
  TurnDetectorProvider,
  VADContext,
  VADProvider,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// STT PROVIDER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a custom STT provider.
 */
export interface CreateCustomSTTProviderOptions {
  /** Provider name for identification */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /** Start the STT session */
  start: (ctx: STTContext) => void;
  /** Stop the STT session */
  stop: () => void;
  /** Send audio data to be transcribed */
  sendAudio: (audio: Float32Array) => void;
}

/**
 * Create a custom STT (Speech-to-Text) provider.
 *
 * @example
 * ```typescript
 * const stt = createCustomSTTProvider({
 *   name: "MySTT",
 *   start: (ctx) => {
 *     // Initialize STT connection
 *     // Use ctx.transcript(), ctx.speechStart(), ctx.speechEnd(), ctx.error()
 *   },
 *   stop: () => {
 *     // Clean up resources
 *   },
 *   sendAudio: (audio) => {
 *     // Send audio to STT service
 *   },
 * });
 * ```
 */
export function createCustomSTTProvider(options: CreateCustomSTTProviderOptions): STTProvider {
  return {
    metadata: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "stt",
    },
    start: options.start,
    stop: options.stop,
    sendAudio: options.sendAudio,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM PROVIDER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a custom LLM provider.
 */
export interface CreateCustomLLMProviderOptions {
  /** Provider name for identification */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /** Generate a response for the given messages */
  generate: (messages: Message[], ctx: LLMContext) => void;
}

/**
 * Create a custom LLM (Language Model) provider.
 *
 * @example
 * ```typescript
 * const llm = createCustomLLMProvider({
 *   name: "MyLLM",
 *   generate: async (messages, ctx) => {
 *     // Stream tokens using ctx.token()
 *     // Report sentences using ctx.sentence()
 *     // Complete with ctx.complete()
 *     // Use ctx.say() for filler phrases
 *   },
 * });
 * ```
 */
export function createCustomLLMProvider(options: CreateCustomLLMProviderOptions): LLMProvider {
  return {
    metadata: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "llm",
    },
    generate: options.generate,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TTS PROVIDER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a custom TTS provider.
 */
export interface CreateCustomTTSProviderOptions {
  /** Provider name for identification */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /** Synthesize text to audio */
  synthesize: (text: string, ctx: TTSContext) => void;
}

/**
 * Create a custom TTS (Text-to-Speech) provider.
 *
 * @example
 * ```typescript
 * const tts = createCustomTTSProvider({
 *   name: "MyTTS",
 *   synthesize: async (text, ctx) => {
 *     // Stream audio chunks using ctx.audioChunk()
 *     // Complete with ctx.complete()
 *     // Handle errors with ctx.error()
 *   },
 * });
 * ```
 */
export function createCustomTTSProvider(options: CreateCustomTTSProviderOptions): TTSProvider {
  return {
    metadata: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "tts",
    },
    synthesize: options.synthesize,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VAD PROVIDER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a custom VAD provider.
 */
export interface CreateCustomVADProviderOptions {
  /** Provider name for identification */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /** Start VAD processing */
  start: (ctx: VADContext) => void;
  /** Stop VAD processing */
  stop: () => void;
  /** Process an audio frame */
  processAudio: (audio: Float32Array) => void;
}

/**
 * Create a custom VAD (Voice Activity Detection) provider.
 *
 * @example
 * ```typescript
 * const vad = createCustomVADProvider({
 *   name: "MyVAD",
 *   start: (ctx) => {
 *     // Initialize VAD
 *     // Use ctx.speechStart(), ctx.speechEnd(), ctx.speechProbability()
 *   },
 *   stop: () => {
 *     // Clean up resources
 *   },
 *   processAudio: (audio) => {
 *     // Analyze audio for speech activity
 *   },
 * });
 * ```
 */
export function createCustomVADProvider(options: CreateCustomVADProviderOptions): VADProvider {
  return {
    metadata: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "vad",
    },
    start: options.start,
    stop: options.stop,
    processAudio: options.processAudio,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TURN DETECTOR PROVIDER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Options for creating a custom Turn Detector provider.
 */
export interface CreateCustomTurnDetectorProviderOptions {
  /** Provider name for identification */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /** Start turn detection */
  start: (ctx: TurnDetectorContext) => void;
  /** Stop turn detection */
  stop: () => void;
  /** Called when VAD detects speech end */
  onSpeechEnd: (duration: number) => void;
  /** Called with transcript updates */
  onTranscript: (text: string, isFinal: boolean) => void;
}

/**
 * Create a custom Turn Detector provider.
 *
 * @example
 * ```typescript
 * const turnDetector = createCustomTurnDetectorProvider({
 *   name: "MyTurnDetector",
 *   start: (ctx) => {
 *     // Initialize turn detection
 *     // Use ctx.turnEnd(), ctx.turnAbandoned()
 *   },
 *   stop: () => {
 *     // Clean up resources
 *   },
 *   onSpeechEnd: (duration) => {
 *     // Handle speech end event
 *   },
 *   onTranscript: (text, isFinal) => {
 *     // Handle transcript updates
 *   },
 * });
 * ```
 */
export function createCustomTurnDetectorProvider(
  options: CreateCustomTurnDetectorProviderOptions,
): TurnDetectorProvider {
  return {
    metadata: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "turn-detector",
    },
    start: options.start,
    stop: options.stop,
    onSpeechEnd: options.onSpeechEnd,
    onTranscript: options.onTranscript,
  };
}
