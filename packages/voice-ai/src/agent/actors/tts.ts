/**
 * TTS (Text-to-Speech) Actor
 *
 * XState callback actor that handles speech synthesis via the TTS provider.
 * This actor is responsible for:
 * - Invoking the TTS provider's `synthesize()` method with the text to speak
 * - Receiving audio chunks as they're produced by the TTS provider
 * - Emitting audio chunk events for streaming playback
 * - Emitting completion events when synthesis finishes
 * - Handling errors from the TTS provider
 * - Respecting abort signals for cancellation
 *
 * The actor receives the text to synthesize and the configured output audio format.
 * It streams audio chunks in real-time, enabling low-latency playback while
 * the TTS provider continues generating audio.
 *
 * @module agent/actors/tts
 */

import { fromCallback } from "xstate";
import type { NormalizedAgentConfig } from "../../types/config";
import type { MachineEvent } from "../../types/events";

export const ttsActor = fromCallback<
  MachineEvent,
  {
    config: NormalizedAgentConfig;
    text: string;
    abortSignal: AbortSignal;
  }
>(({ sendBack, input }) => {
  const { config, text, abortSignal } = input;
  const provider = config.tts;
  const outputFormat = config.audio.output;

  provider.synthesize(text, {
    audioFormat: outputFormat,
    audioChunk: (audio) => {
      sendBack({ type: "_tts:chunk", audio, timestamp: Date.now() });
    },
    complete: () => sendBack({ type: "_tts:complete", timestamp: Date.now() }),
    error: (error) => sendBack({ type: "_tts:error", error, timestamp: Date.now() }),
    signal: abortSignal,
  });
});
