/**
 * Provider Types
 *
 * These interfaces define the contracts that provider packages must implement.
 * Each provider receives a context object with emit methods (to report events) and
 * control methods (to trigger orchestration features).
 *
 * Provider packages (e.g., @voice-ai/provider-deepgram) implement these interfaces
 * via factory functions like createDeepgramSTT({ apiKey, model }).
 */

import type { Message } from "../types/common";
import type { AudioFormat } from "../types/config";

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER METADATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Provider type identifier.
 */
export type ProviderType = "stt" | "llm" | "tts" | "vad" | "turn-detector";

/**
 * Metadata included with every provider for debugging and identification.
 */
export interface ProviderMetadata {
  /**
   * Human-readable provider name.
   * @example "Deepgram", "OpenAI", "ElevenLabs"
   */
  name: string;

  /**
   * Provider package version.
   * @example "1.0.0"
   */
  version: string;

  /**
   * Provider type for categorization.
   */
  type: ProviderType;
}

/**
 * Base interface that all providers extend.
 * Contains metadata for debugging and identification.
 */
export interface BaseProvider {
  /**
   * Provider metadata for debugging and identification.
   */
  readonly metadata: ProviderMetadata;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STT (Speech-to-Text) PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to STT providers.
 * Contains emit methods for reporting transcription events.
 */
export interface STTContext {
  /**
   * Audio format configuration.
   * STT providers should expect audio input in this format.
   */
  audioFormat: AudioFormat;

  /**
   * Report a transcript update.
   * @param text - The transcribed text
   * @param isFinal - Whether this is a final transcript (true) or partial (false)
   */
  transcript(text: string, isFinal: boolean): void;

  /**
   * Report that speech has started (VAD event).
   * Used as fallback when no dedicated VAD provider is provided.
   */
  speechStart(): void;

  /**
   * Report that speech has ended (VAD event).
   * Used as fallback when no dedicated VAD provider is provided.
   */
  speechEnd(): void;

  /**
   * Report an error.
   */
  error(error: Error): void;

  /**
   * Abort signal for cancellation.
   * Providers should respect this signal and clean up when aborted.
   */
  signal: AbortSignal;
}

/**
 * Speech-to-Text provider interface.
 * Provider packages implement this to integrate STT services.
 *
 * @example
 * ```typescript
 * import { createDeepgramSTT } from '@voice-ai/provider-deepgram';
 *
 * const stt = createDeepgramSTT({
 *   apiKey: process.env.DEEPGRAM_API_KEY,
 *   model: 'nova-2',
 *   language: 'en-US',
 * });
 * ```
 */
export interface STTProvider extends BaseProvider {
  /**
   * Start the STT session.
   * @param ctx - Context with emit methods and abort signal
   */
  start(ctx: STTContext): void;

  /**
   * Stop the STT session and clean up resources.
   */
  stop(): void;

  /**
   * Send audio data to be transcribed.
   * @param audio - Raw audio samples
   */
  sendAudio(audio: Float32Array): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM (Language Model) PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to LLM providers.
 * Contains emit methods for reporting generation events and orchestration controls.
 * LLM providers can use orchestration methods to trigger filler phrases while generating.
 */
export interface LLMContext {
  /**
   * Trigger speech immediately (for fillers, acknowledgments, etc.).
   * This will be synthesized and streamed while waiting for the main response.
   * @param text - Text to speak
   */
  say(text: string): void;

  /**
   * Interrupt/stop current speech streaming.
   * Use this when the main response arrives and a filler is still playing.
   */
  interrupt(): void;

  /**
   * Check if the agent is currently speaking.
   * Useful for deciding whether to trigger fillers.
   */
  isSpeaking(): boolean;
  /**
   * Report a token from the stream.
   * @param token - The generated token
   */
  token(token: string): void;

  /**
   * Report a complete sentence.
   * Used for sentence-level streaming to TTS.
   * @param sentence - The complete sentence
   * @param index - Sentence index in the response
   */
  sentence(sentence: string, index: number): void;

  /**
   * Report that generation is complete.
   * @param fullText - The complete generated text
   */
  complete(fullText: string): void;

  /**
   * Report an error.
   */
  error(error: Error): void;

  /**
   * Abort signal for cancellation.
   */
  signal: AbortSignal;
}

/**
 * Language Model provider interface.
 * Provider packages implement this to integrate LLM services.
 * System prompts, tools, and model selection are handled inside the provider.
 *
 * @example
 * ```typescript
 * import { createOpenAILLM } from '@voice-ai/provider-openai';
 *
 * const llm = createOpenAILLM({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4o',
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 * ```
 */
export interface LLMProvider extends BaseProvider {
  /**
   * Generate a response for the given messages.
   * @param messages - Conversation history
   * @param ctx - Context with emit and control methods
   */
  generate(messages: Message[], ctx: LLMContext): void;

  /**
   * Cancel ongoing generation.
   */
  cancel(): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TTS (Text-to-Speech) PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to TTS providers.
 * Contains emit methods for reporting synthesis events.
 */
export interface TTSContext {
  /**
   * Audio format configuration.
   * TTS providers should produce audio output in this format.
   */
  audioFormat: AudioFormat;

  /**
   * Report an audio chunk (for streaming TTS).
   * @param audio - Audio samples
   */
  audioChunk(audio: Float32Array): void;

  /**
   * Report that synthesis is complete.
   */
  complete(): void;

  /**
   * Report an error.
   */
  error(error: Error): void;

  /**
   * Abort signal for cancellation.
   */
  signal: AbortSignal;
}

/**
 * Text-to-Speech provider interface.
 * Provider packages implement this to integrate TTS services.
 *
 * @example
 * ```typescript
 * import { createElevenLabsTTS } from '@voice-ai/provider-elevenlabs';
 *
 * const tts = createElevenLabsTTS({
 *   apiKey: process.env.ELEVENLABS_API_KEY,
 *   voiceId: 'rachel',
 * });
 * ```
 */
export interface TTSProvider extends BaseProvider {
  /**
   * Synthesize text to audio.
   * @param text - Text to synthesize
   * @param ctx - Context with emit methods
   */
  synthesize(text: string, ctx: TTSContext): void;

  /**
   * Cancel ongoing synthesis.
   */
  cancel(): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VAD (Voice Activity Detection) PROVIDER - OPTIONAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to VAD providers.
 * Contains emit methods for reporting speech activity.
 */
export interface VADContext {
  /**
   * Report that speech has started.
   */
  speechStart(): void;

  /**
   * Report that speech has ended.
   * @param duration - Duration of the speech in milliseconds
   */
  speechEnd(duration: number): void;

  /**
   * Report speech probability (for visualization).
   * Optional - only call if your VAD provides probability scores.
   * @param probability - Speech probability (0-1)
   */
  speechProbability(probability: number): void;

  /**
   * Abort signal for cancellation.
   */
  signal: AbortSignal;
}

/**
 * Voice Activity Detection provider interface.
 * Optional - if not provided, STT's built-in VAD is used as fallback.
 * Useful for client-side VAD (like Silero) for faster barge-in detection.
 *
 * @example
 * ```typescript
 * import { createSileroVAD } from '@voice-ai/provider-silero';
 *
 * const vad = createSileroVAD({
 *   threshold: 0.5,
 *   minSpeechDuration: 250,
 * });
 * ```
 */
export interface VADProvider extends BaseProvider {
  /**
   * Start VAD processing.
   * @param ctx - Context with emit methods
   */
  start(ctx: VADContext): void;

  /**
   * Stop VAD processing.
   */
  stop(): void;

  /**
   * Process an audio frame.
   * @param audio - Audio samples to analyze
   */
  processAudio(audio: Float32Array): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TURN DETECTOR PROVIDER - OPTIONAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to Turn Detector providers.
 * Contains emit methods for reporting turn boundaries.
 */
export interface TurnDetectorContext {
  /**
   * Report that the user's turn has ended.
   * @param transcript - The complete transcript for this turn
   */
  turnEnd(transcript: string): void;

  /**
   * Report that the turn was abandoned (too short, noise, etc.).
   * @param reason - Reason for abandonment
   */
  turnAbandoned(reason: string): void;

  /**
   * Abort signal for cancellation.
   */
  signal: AbortSignal;
}

/**
 * Turn Detector provider interface.
 * Optional - if not provided, STT's final transcript marks turn end.
 * Useful for semantic turn detection (e.g., detecting questions end faster).
 *
 * @example
 * ```typescript
 * import { createSemanticTurnDetector } from '@voice-ai/provider-turn-detector';
 *
 * const turnDetector = createSemanticTurnDetector({
 *   silenceThresholdMs: 500,
 * });
 * ```
 */
export interface TurnDetectorProvider extends BaseProvider {
  /**
   * Start turn detection.
   * @param ctx - Context with emit methods
   */
  start(ctx: TurnDetectorContext): void;

  /**
   * Stop turn detection.
   */
  stop(): void;

  /**
   * Called when VAD detects speech end.
   * @param duration - Duration of the speech in milliseconds
   */
  onSpeechEnd(duration: number): void;

  /**
   * Called with transcript updates.
   * @param text - Transcript text
   * @param isFinal - Whether this is a final transcript
   */
  onTranscript(text: string, isFinal: boolean): void;
}
