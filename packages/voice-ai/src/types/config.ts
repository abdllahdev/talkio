/**
 * Agent Configuration Types
 *
 * Defines the configuration types for creating voice AI agents.
 *
 * @module types/config
 */

import type { AudioConfig, AudioFormat, NormalizedAudioConfig } from "../audio/types";
import type {
  ExtractSTTInputFormat,
  ExtractTTSOutputFormat,
  LLMInput,
  STTProvider,
  TTSProvider,
  TurnDetectorProvider,
  VADProvider,
} from "../providers/types";
import type { AgentEvent } from "./events";

// Re-export AudioFormat types from audio module
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
} from "../audio/types";

export {
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_AUDIO_FORMAT,
  normalizeAudioConfig,
  normalizeFormat,
} from "../audio/types";

/**
 * Interruption detection configuration.
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   stt, llm, tts,
 *   interruption: {
 *     enabled: true,
 *     minDurationMs: 200,
 *   },
 * });
 * ```
 */
export interface InterruptionConfig {
  /** Whether interruption detection is enabled. @default true */
  enabled?: boolean;

  /** Minimum speech duration in milliseconds before treating as interruption. @default 200 */
  minDurationMs?: number;
}

/**
 * Configuration for {@link createAgent}.
 *
 * @typeParam STT - The STT provider type (inferred from stt property)
 * @typeParam TTS - The TTS provider type (inferred from tts property)
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   stt: deepgram.stt({ model: "nova-3" }),
 *   llm: myLLMProvider,
 *   tts: deepgram.tts({ model: "aura-2-thalia-en" }),
 *   vad: myVADProvider,
 *   turnDetector: myTurnDetector,
 *   interruption: { enabled: true, minDurationMs: 200 },
 *   audio: {
 *     input: { encoding: "linear16", sampleRate: 16000 },
 *     output: { encoding: "linear16", sampleRate: 24000 },
 *   },
 *   onEvent: (event) => console.log(event),
 * });
 * ```
 */
export interface AgentConfig<
  STT extends STTProvider<AudioFormat> = STTProvider,
  TTS extends TTSProvider<AudioFormat> = TTSProvider,
> {
  /**
   * **Required.** Speech-to-Text provider.
   *
   * Transcribes user speech into text. Must implement the {@link STTProvider} interface.
   * The provider's supported input formats determine which audio encodings are allowed
   * in the `audio.input` configuration.
   *
   * @example
   * ```typescript
   * import { createDeepgram } from "@voice-ai/deepgram";
   * const deepgram = createDeepgram({ apiKey: "..." });
   * stt: deepgram.stt({ model: "nova-3" })
   * ```
   */
  stt: STT;

  /**
   * **Required.** Language Model provider or function.
   *
   * Generates responses based on conversation history. Can be either:
   * - A full {@link LLMProvider} object with metadata and generate method
   * - A simple {@link LLMFunction} that uses `ctx.signal` for cancellation
   *
   * @example Using a provider object
   * ```typescript
   * const llm = createOpenAILLM({ apiKey: "...", model: "gpt-4o" });
   * ```
   *
   * @example Using a function
   * ```typescript
   * const llm: LLMFunction = async (ctx) => {
   *   const response = await openai.chat.completions.create({
   *     model: "gpt-4",
   *     messages: ctx.messages,
   *     stream: true,
   *   }, { signal: ctx.signal });
   *   // Stream tokens using ctx.token(), ctx.sentence(), ctx.complete()
   * };
   * ```
   */
  llm: LLMInput;

  /**
   * **Required.** Text-to-Speech provider.
   *
   * Synthesizes text into speech audio. Must implement the {@link TTSProvider} interface.
   * The provider's supported output formats determine which audio encodings are allowed
   * in the `audio.output` configuration.
   *
   * @example
   * ```typescript
   * import { createDeepgram } from "@voice-ai/deepgram";
   * const deepgram = createDeepgram({ apiKey: "..." });
   * tts: deepgram.tts({ model: "aura-2-thalia-en" })
   * ```
   */
  tts: TTS;

  /**
   * **Optional.** Voice Activity Detection provider.
   *
   * If not provided, the STT provider's built-in VAD is used as fallback.
   * Dedicated VAD providers (like Silero) can provide faster interruption detection
   * by running client-side without waiting for STT processing.
   *
   * @example
   * ```typescript
   * import { createSileroVAD } from "@voice-ai/silero";
   * vad: createSileroVAD({ threshold: 0.5 })
   * ```
   */
  vad?: VADProvider;

  /**
   * **Optional.** Turn Detector provider.
   *
   * If not provided, the STT provider's final transcript marks turn end.
   * Custom turn detectors can implement semantic turn detection (e.g., detecting
   * question endings faster) or other advanced turn-taking logic.
   *
   * @example
   * ```typescript
   * turnDetector: createCustomTurnDetectorProvider({
   *   name: "MyTurnDetector",
   *   // ... implementation
   * })
   * ```
   */
  turnDetector?: TurnDetectorProvider;

  /**
   * **Optional.** Interruption detection configuration.
   *
   * Controls whether users can interrupt the agent while it's speaking.
   * When enabled, the agent will stop speaking and start listening when
   * it detects user speech during an AI turn.
   *
   * @example
   * ```typescript
   * interruption: {
   *   enabled: true,
   *   minDurationMs: 200, // Ignore sounds shorter than 200ms
   * }
   * ```
   */
  interruption?: InterruptionConfig;

  /**
   * **Optional.** Audio configuration with separate input and output formats.
   *
   * If omitted, the provider's default formats are used:
   * - Input format defaults to `stt.metadata.defaultInputFormat`
   * - Output format defaults to `tts.metadata.defaultOutputFormat`
   *
   * Only `encoding` is required in each format; `sampleRate` and `channels`
   * have sensible defaults based on the encoding type.
   *
   * **TypeScript narrows the allowed encodings** based on the selected providers:
   * - Input encoding must be supported by the STT provider
   * - Output format must be supported by the TTS provider
   *
   * @example
   * ```typescript
   * audio: {
   *   input: { encoding: "linear16", sampleRate: 16000 },  // STT input
   *   output: { encoding: "linear16", sampleRate: 24000 }, // TTS output
   * }
   * ```
   */
  audio?: AudioConfig<ExtractSTTInputFormat<STT>, ExtractTTSOutputFormat<TTS>>;

  /**
   * **Optional.** Event handler callback for all agent events.
   *
   * Called for all public events (lifecycle, human turn, AI turn, debug).
   * Use this for observability, logging, UI updates, and monitoring.
   *
   * @param event - The agent event that occurred (see {@link AgentEvent})
   *
   * @example
   * ```typescript
   * onEvent: (event) => {
   *   switch (event.type) {
   *     case "human-turn:ended":
   *       console.log("User:", event.transcript);
   *       break;
   *     case "ai-turn:sentence":
   *       console.log("Agent:", event.sentence);
   *       break;
   *     case "agent:error":
   *       console.error("Error:", event.error, "from", event.source);
   *       break;
   *   }
   * }
   * ```
   */
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Normalized agent config where audio is always defined with all format fields.
 * Used internally by the agent machine context.
 *
 * @typeParam InputFormat - The input format type (from STT provider)
 * @typeParam OutputFormat - The output format type (from TTS provider)
 */
export type NormalizedAgentConfig<
  InputFormat extends AudioFormat = AudioFormat,
  OutputFormat extends AudioFormat = AudioFormat,
> = Omit<AgentConfig<STTProvider<InputFormat>, TTSProvider<OutputFormat>>, "audio"> & {
  audio: NormalizedAudioConfig;
};
