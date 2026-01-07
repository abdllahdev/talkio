/**
 * Adapter Types
 *
 * These interfaces define the contracts that user-provided adapters must implement.
 * Each adapter receives a context object with emit methods (to report events) and
 * control methods (to trigger orchestration features).
 */

import type { Message } from "../types/common";

// ═══════════════════════════════════════════════════════════════════════════════
// COMMON ORCHESTRATION CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common orchestration methods available to all adapters.
 * These allow adapters to trigger speech and interruptions.
 */
export interface OrchestrationContext {
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// STT (Speech-to-Text) ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to STT adapters.
 * Contains emit methods for reporting transcription events and control methods.
 */
export interface STTContext extends OrchestrationContext {
  /**
   * Report a transcript update.
   * @param text - The transcribed text
   * @param isFinal - Whether this is a final transcript (true) or partial (false)
   */
  transcript(text: string, isFinal: boolean): void;

  /**
   * Report that speech has started (VAD event).
   * Used as fallback when no dedicated VAD adapter is provided.
   */
  speechStart(): void;

  /**
   * Report that speech has ended (VAD event).
   * Used as fallback when no dedicated VAD adapter is provided.
   */
  speechEnd(): void;

  /**
   * Report an error.
   */
  error(error: Error): void;

  /**
   * Abort signal for cancellation.
   * Adapters should respect this signal and clean up when aborted.
   */
  signal: AbortSignal;
}

/**
 * Speech-to-Text adapter interface.
 * Users implement this to integrate their STT provider (Deepgram, AssemblyAI, etc.).
 */
export interface STTAdapter {
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
// LLM (Language Model) ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to LLM adapters.
 * Contains emit methods for reporting generation events and control methods.
 */
export interface LLMContext extends OrchestrationContext {
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
 * Language Model adapter interface.
 * Users implement this to integrate their LLM provider (OpenAI, Anthropic, etc.).
 * System prompts, tools, and model selection are handled inside the adapter.
 */
export interface LLMAdapter {
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
// TTS (Text-to-Speech) ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to TTS adapters.
 * Contains emit methods for reporting synthesis events and control methods.
 */
export interface TTSContext extends OrchestrationContext {
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
 * Text-to-Speech adapter interface.
 * Users implement this to integrate their TTS provider (ElevenLabs, Cartesia, etc.).
 */
export interface TTSAdapter {
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
// VAD (Voice Activity Detection) ADAPTER - OPTIONAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to VAD adapters.
 * Contains emit methods for reporting speech activity and control methods.
 */
export interface VADContext extends OrchestrationContext {
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
 * Voice Activity Detection adapter interface.
 * Optional - if not provided, STT's built-in VAD is used as fallback.
 * Useful for client-side VAD (like Silero) for faster barge-in detection.
 */
export interface VADAdapter {
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
// TURN DETECTOR ADAPTER - OPTIONAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to Turn Detector adapters.
 * Contains emit methods for reporting turn boundaries and control methods.
 */
export interface TurnDetectorContext extends OrchestrationContext {
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
 * Turn Detector adapter interface.
 * Optional - if not provided, STT's final transcript marks turn end.
 * Useful for semantic turn detection (e.g., detecting questions end faster).
 */
export interface TurnDetectorAdapter {
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

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO OUTPUT ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context provided to Audio Streamer adapters.
 * Contains emit methods for reporting streaming events and control methods.
 */
export interface AudioStreamerContext extends OrchestrationContext {
  /**
   * Report that streaming of all queued audio is complete.
   */
  streamEnd(): void;

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
 * Audio Streamer adapter interface.
 * Users implement this to handle audio streaming (Web Audio API, node speaker, etc.).
 */
export interface AudioStreamerAdapter {
  /**
   * Start the audio output.
   * @param ctx - Context with emit methods
   */
  start(ctx: AudioStreamerContext): void;

  /**
   * Stream audio data.
   * @param audio - Audio samples to stream
   */
  stream(audio: Float32Array): void;

  /**
   * Stop all streaming immediately.
   */
  stop(): void;
}
