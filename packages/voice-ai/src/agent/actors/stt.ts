/**
 * STT (Speech-to-Text) Actor
 *
 * Handles speech recognition via the STT provider.
 * Receives audio input and emits transcript events.
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

export const sttActor = fromCallback<
  MachineEvent,
  {
    config: AgentConfig;
    abortSignal: AbortSignal;
  }
>(({ sendBack, receive, input }) => {
  const { config, abortSignal } = input;
  const provider = config.stt;
  const audioFormat = config.audioFormat ?? DEFAULT_AUDIO_FORMAT;

  provider.start({
    audioFormat,
    transcript: (text, isFinal) => {
      sendBack({ type: "_stt:transcript", text, isFinal });
    },
    speechStart: () => {
      sendBack({ type: "_stt:speech-start" });
    },
    speechEnd: () => {
      sendBack({ type: "_stt:speech-end" });
    },
    error: (error) => {
      sendBack({ type: "_stt:error", error });
    },
    signal: abortSignal,
  });

  receive((event) => {
    if (event.type === "_audio:input") {
      provider.sendAudio(event.audio);
    }
  });

  return () => provider.stop();
});
