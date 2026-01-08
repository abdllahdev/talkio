/**
 * Provider Factory Functions
 *
 * Helper functions for creating custom provider implementations.
 *
 * These factory functions simplify the creation of custom providers by handling
 * the boilerplate of provider metadata, type safety, and context management.
 * They're useful when you want to integrate your own STT, LLM, or TTS services
 * without implementing the full provider interface from scratch.
 *
 * **Available Factories**:
 * - `createCustomSTTProvider` - Create a custom speech-to-text provider
 * - `createCustomLLMProvider` - Create a custom language model provider
 * - `createCustomTTSProvider` - Create a custom text-to-speech provider
 * - `createCustomVADProvider` - Create a custom voice activity detection provider
 * - `createCustomTurnDetectorProvider` - Create a custom turn detector provider
 *
 * Each factory accepts options that define the provider's behavior and metadata,
 * and returns a fully typed provider that can be used with `createAgent()`.
 *
 * @example Creating a custom STT provider
 * ```typescript
 * const mySTT = createCustomSTTProvider({
 *   name: "MySTT",
 *   supportedInputFormats: [{ encoding: "linear16", sampleRate: 16000, channels: 1 }],
 *   defaultInputFormat: { encoding: "linear16", sampleRate: 16000, channels: 1 },
 *   start: (ctx) => {
 *     // Initialize connection
 *   },
 *   stop: () => {
 *     // Cleanup
 *   },
 *   sendAudio: (audio) => {
 *     // Send to service
 *   },
 * });
 * ```
 *
 * @module providers/factories
 */

import type { AudioFormat } from "../audio/types";
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

/**
 * Options for creating a custom STT provider.
 *
 * @typeParam InputFormat - The audio format type(s) this provider accepts
 */
export interface CreateCustomSTTProviderOptions<InputFormat extends AudioFormat = AudioFormat> {
  /** Provider name for identification (e.g., "MySTT", "CustomSTT") */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /** Audio formats this provider accepts as input (must be a const array) */
  supportedInputFormats: readonly InputFormat[];
  /** Default input format used when audio config is not specified in createAgent */
  defaultInputFormat: InputFormat;
  /** Start the STT session - initialize connections, set up listeners */
  start: (ctx: STTContext) => void;
  /** Stop the STT session - clean up resources, close connections */
  stop: () => void;
  /** Send audio data to be transcribed - called with audio chunks from the agent */
  sendAudio: (audio: ArrayBuffer) => void;
}

/**
 * Create a custom STT (Speech-to-Text) provider.
 *
 * Use this function to create a custom STT provider that integrates with
 * your own speech-to-text service or library. The provider must implement
 * the STT provider interface with start, stop, and sendAudio methods.
 *
 * @typeParam InputFormat - The audio format type(s) this provider accepts
 * @param options - Configuration options for the custom STT provider
 * @returns A typed STT provider that can be used in createAgent
 *
 * @example
 * ```typescript
 * // Define your supported formats as a const array
 * const formats = [
 *   { encoding: "linear16", sampleRate: 16000, channels: 1 },
 *   { encoding: "linear16", sampleRate: 24000, channels: 1 },
 * ] as const;
 *
 * const stt = createCustomSTTProvider({
 *   name: "MySTT",
 *   supportedInputFormats: formats,
 *   defaultInputFormat: formats[0],
 *   start: (ctx) => {
 *     // Initialize STT connection
 *     // ctx.audioFormat contains the selected format (normalized)
 *     // Use ctx.transcript(text, isFinal) to report transcripts
 *     // Use ctx.speechStart() and ctx.speechEnd() for VAD events
 *     // Use ctx.error(error) to report errors
 *     // Respect ctx.signal for cancellation
 *   },
 *   stop: () => {
 *     // Clean up resources, close connections
 *   },
 *   sendAudio: (audio) => {
 *     // Send audio (ArrayBuffer) to your STT service
 *     // Audio is already in the configured format
 *   },
 * });
 * ```
 */
export function createCustomSTTProvider<InputFormat extends AudioFormat>(
  options: CreateCustomSTTProviderOptions<InputFormat>,
): STTProvider<InputFormat> {
  return {
    metadata: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "stt",
      supportedInputFormats: options.supportedInputFormats,
      defaultInputFormat: options.defaultInputFormat,
    },
    start: options.start,
    stop: options.stop,
    sendAudio: options.sendAudio,
  };
}

/**
 * Options for creating a custom LLM provider.
 */
export interface CreateCustomLLMProviderOptions {
  /** Provider name for identification (e.g., "MyLLM", "CustomLLM") */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /**
   * Generate a response for the given messages.
   *
   * This function should:
   * - Stream tokens using `ctx.token(token)` as they're generated
   * - Report complete sentences using `ctx.sentence(sentence, index)`
   * - Complete with `ctx.complete(fullText)` when done
   * - Use `ctx.say(text)` for filler phrases/acknowledgments
   * - Use `ctx.interrupt()` to stop current speech
   * - Report errors using `ctx.error(error)`
   * - Respect `ctx.signal` for cancellation
   *
   * @param messages - Conversation history (system, user, assistant, tool messages)
   * @param ctx - LLM context with emit methods and conversation controls
   */
  generate: (messages: Message[], ctx: LLMContext) => void;
}

/**
 * Create a custom LLM (Language Model) provider.
 *
 * Use this function to create a custom LLM provider that integrates with
 * your own language model service or library. The provider must implement
 * streaming token generation and sentence detection.
 *
 * @param options - Configuration options for the custom LLM provider
 * @returns An LLM provider that can be used in createAgent
 *
 * @example
 * ```typescript
 * const llm = createCustomLLMProvider({
 *   name: "MyLLM",
 *   generate: async (messages, ctx) => {
 *     const response = await myLLMService.stream({
 *       messages,
 *       signal: ctx.signal, // Respect cancellation
 *     });
 *
 *     let fullText = "";
 *     let sentenceBuffer = "";
 *     let sentenceIndex = 0;
 *
 *     for await (const chunk of response) {
 *       const token = chunk.token;
 *       fullText += token;
 *       sentenceBuffer += token;
 *
 *       // Stream token
 *       ctx.token(token);
 *
 *       // Detect sentence end (simplified)
 *       if (token.match(/[.!?]\s*$/)) {
 *         ctx.sentence(sentenceBuffer.trim(), sentenceIndex++);
 *         sentenceBuffer = "";
 *       }
 *     }
 *
 *     // Complete
 *     ctx.complete(fullText);
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

/**
 * Options for creating a custom TTS provider.
 *
 * @typeParam OutputFormat - The audio format type(s) this provider can output
 */
export interface CreateCustomTTSProviderOptions<OutputFormat extends AudioFormat = AudioFormat> {
  /** Provider name for identification (e.g., "MyTTS", "CustomTTS") */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /** Audio formats this provider can output (must be a const array) */
  supportedOutputFormats: readonly OutputFormat[];
  /** Default output format used when audio config is not specified in createAgent */
  defaultOutputFormat: OutputFormat;
  /**
   * Synthesize text to audio.
   *
   * This function should:
   * - Stream audio chunks using `ctx.audioChunk(audio)` as they're synthesized
   * - Complete with `ctx.complete()` when synthesis is done
   * - Report errors using `ctx.error(error)`
   * - Respect `ctx.signal` for cancellation
   * - Produce audio in the format specified by `ctx.audioFormat`
   *
   * @param text - Text to synthesize
   * @param ctx - TTS context with emit methods and audio format
   */
  synthesize: (text: string, ctx: TTSContext) => void;
}

/**
 * Create a custom TTS (Text-to-Speech) provider.
 *
 * Use this function to create a custom TTS provider that integrates with
 * your own text-to-speech service or library. The provider must implement
 * streaming audio synthesis.
 *
 * @typeParam OutputFormat - The audio format type(s) this provider can output
 * @param options - Configuration options for the custom TTS provider
 * @returns A typed TTS provider that can be used in createAgent
 *
 * @example
 * ```typescript
 * // Define your supported formats as a const array
 * const formats = [
 *   { encoding: "linear16", sampleRate: 24000, channels: 1 },
 *   { encoding: "linear16", sampleRate: 48000, channels: 1 },
 * ] as const;
 *
 * const tts = createCustomTTSProvider({
 *   name: "MyTTS",
 *   supportedOutputFormats: formats,
 *   defaultOutputFormat: formats[0],
 *   synthesize: async (text, ctx) => {
 *     // ctx.audioFormat contains the selected format (normalized)
 *     const response = await myTTSService.synthesize({
 *       text,
 *       encoding: ctx.audioFormat.encoding,
 *       sampleRate: ctx.audioFormat.sampleRate,
 *       signal: ctx.signal, // Respect cancellation
 *     });
 *
 *     // Stream audio chunks as they arrive
 *     for await (const chunk of response) {
 *       ctx.audioChunk(chunk); // ArrayBuffer in the configured format
 *     }
 *
 *     // Complete
 *     ctx.complete();
 *   },
 * });
 * ```
 */
export function createCustomTTSProvider<OutputFormat extends AudioFormat>(
  options: CreateCustomTTSProviderOptions<OutputFormat>,
): TTSProvider<OutputFormat> {
  return {
    metadata: {
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "tts",
      supportedOutputFormats: options.supportedOutputFormats,
      defaultOutputFormat: options.defaultOutputFormat,
    },
    synthesize: options.synthesize,
  };
}

/**
 * Options for creating a custom VAD provider.
 */
export interface CreateCustomVADProviderOptions {
  /** Provider name for identification (e.g., "MyVAD", "CustomVAD") */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /**
   * Start VAD processing.
   * Initialize your VAD model or service here.
   *
   * @param ctx - VAD context with emit methods
   */
  start: (ctx: VADContext) => void;
  /**
   * Stop VAD processing.
   * Clean up resources, close connections.
   */
  stop: () => void;
  /**
   * Process an audio frame for speech activity detection.
   *
   * Called with each audio chunk from the agent. Analyze the audio
   * and emit events:
   * - `ctx.speechStart()` when speech begins
   * - `ctx.speechEnd(duration)` when speech ends
   * - `ctx.speechProbability(prob)` for probability scores (optional)
   *
   * @param audio - Audio data (ArrayBuffer) in the configured input format
   */
  processAudio: (audio: ArrayBuffer) => void;
}

/**
 * Create a custom VAD (Voice Activity Detection) provider.
 *
 * VAD providers detect when the user is speaking, enabling faster
 * interruption detection and turn management. If not provided, the STT
 * provider's built-in VAD is used as fallback.
 *
 * @param options - Configuration options for the custom VAD provider
 * @returns A VAD provider that can be used in createAgent
 *
 * @example
 * ```typescript
 * const vad = createCustomVADProvider({
 *   name: "MyVAD",
 *   start: (ctx) => {
 *     // Initialize VAD model
 *     // Use ctx.speechStart() when speech detected
 *     // Use ctx.speechEnd(duration) when speech ends
 *     // Use ctx.speechProbability(prob) for visualization (optional)
 *   },
 *   stop: () => {
 *     // Clean up resources
 *   },
 *   processAudio: (audio) => {
 *     // Analyze audio frame for speech activity
 *     const probability = analyzeSpeech(audio);
 *     if (probability > 0.5) {
 *       ctx.speechStart();
 *     }
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

/**
 * Options for creating a custom Turn Detector provider.
 */
export interface CreateCustomTurnDetectorProviderOptions {
  /** Provider name for identification (e.g., "MyTurnDetector", "CustomTurnDetector") */
  name: string;
  /** Provider version (defaults to "1.0.0") */
  version?: string;
  /**
   * Start turn detection.
   * Initialize your turn detection logic here.
   *
   * @param ctx - Turn detector context with emit methods
   */
  start: (ctx: TurnDetectorContext) => void;
  /**
   * Stop turn detection.
   * Clean up resources.
   */
  stop: () => void;
  /**
   * Called when VAD detects speech end.
   * Use this to trigger turn detection logic based on speech duration.
   *
   * @param duration - Duration of the speech in milliseconds
   */
  onSpeechEnd: (duration: number) => void;
  /**
   * Called with transcript updates from the STT provider.
   * Use this to implement semantic turn detection (e.g., detecting question endings).
   *
   * @param text - Transcript text (partial or final)
   * @param isFinal - Whether this is a final transcript (true) or partial (false)
   */
  onTranscript: (text: string, isFinal: boolean) => void;
}

/**
 * Create a custom Turn Detector provider.
 *
 * Turn detectors determine when a user's turn has ended, enabling faster
 * turn-taking and better conversation flow. If not provided, the STT
 * provider's final transcript marks turn end.
 *
 * Custom turn detectors can implement:
 * - Semantic turn detection (detecting question endings, pauses)
 * - Silence-based detection (longer silence = turn end)
 * - Confidence-based detection (low confidence = turn end)
 *
 * @param options - Configuration options for the custom turn detector provider
 * @returns A turn detector provider that can be used in createAgent
 *
 * @example
 * ```typescript
 * const turnDetector = createCustomTurnDetectorProvider({
 *   name: "MyTurnDetector",
 *   start: (ctx) => {
 *     // Initialize turn detection
 *     // Use ctx.turnEnd(transcript) when turn ends
 *     // Use ctx.turnAbandoned(reason) when turn is invalid
 *   },
 *   stop: () => {
 *     // Clean up resources
 *   },
 *   onSpeechEnd: (duration) => {
 *     // Handle speech end - maybe wait for silence
 *     if (duration > 1000) {
 *       // Long speech, likely a complete turn
 *     }
 *   },
 *   onTranscript: (text, isFinal) => {
 *     // Semantic detection: if ends with "?", turn is likely complete
 *     if (isFinal && text.trim().endsWith("?")) {
 *       ctx.turnEnd(text);
 *     }
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
