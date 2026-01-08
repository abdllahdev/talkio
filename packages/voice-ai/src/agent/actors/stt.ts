/**
 * STT (Speech-to-Text) Actor
 *
 * XState callback actor that handles speech recognition via the STT provider.
 * This actor is responsible for:
 * - Starting the STT provider with the configured audio format
 * - Receiving audio input chunks from the agent machine
 * - Forwarding audio to the STT provider for transcription
 * - Emitting transcript events (partial and final) as they arrive
 * - Emitting VAD events (speech start/end) if the STT provider supports them
 * - Handling errors from the STT provider
 * - Cleaning up the STT provider when stopped
 *
 * The actor acts as a bridge between the agent state machine and the STT provider,
 * translating audio input into transcript events that drive the conversation flow.
 *
 * @module agent/actors/stt
 */

import { fromCallback } from "xstate";
import type { NormalizedAgentConfig } from "../../types/config";
import type { MachineEvent } from "../../types/events";

export const sttActor = fromCallback<
  MachineEvent,
  {
    config: NormalizedAgentConfig;
    abortSignal: AbortSignal;
  }
>(({ sendBack, receive, input }) => {
  const { config, abortSignal } = input;
  const provider = config.stt;
  const inputFormat = config.audio.input;

  provider.start({
    audioFormat: inputFormat,
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
