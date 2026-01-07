/**
 * TTS (Text-to-Speech) Actor
 *
 * Handles speech synthesis via the TTS provider.
 * Converts text to audio chunks.
 */

import { fromCallback } from "xstate";
import type { AgentConfig, AudioFormat } from "../../types/config";
import type { MachineEvent } from "../../types/events";

/** Default audio format if not specified in config */
const DEFAULT_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 32,
};

export const ttsActor = fromCallback<
  MachineEvent,
  {
    config: AgentConfig;
    text: string;
    abortSignal: AbortSignal;
  }
>(({ sendBack, input }) => {
  const { config, text, abortSignal } = input;
  const audioFormat = config.audioFormat ?? DEFAULT_AUDIO_FORMAT;

  config.tts.synthesize(text, {
    audioFormat,
    audioChunk: (audio) => sendBack({ type: "_tts:chunk", audio }),
    complete: () => sendBack({ type: "_tts:complete" }),
    error: (error) => sendBack({ type: "_tts:error", error }),
    signal: abortSignal,
  });

  return () => config.tts.cancel();
});
