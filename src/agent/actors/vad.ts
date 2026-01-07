/**
 * VAD (Voice Activity Detection) Actor
 *
 * Handles voice activity detection via the VAD adapter.
 * Detects speech start/end and provides speech probability.
 */

import { fromCallback } from "xstate";
import type { ResolvedAgentConfig } from "../../types/config";
import type { AgentEvent } from "../../types/events";

export const vadActor = fromCallback<
  AgentEvent,
  {
    config: ResolvedAgentConfig;
    abortSignal: AbortSignal;
    sayFn: (text: string) => void;
    interruptFn: () => void;
    isSpeakingFn: () => boolean;
  }
>(({ sendBack, receive, input }) => {
  const { config, abortSignal, sayFn, interruptFn, isSpeakingFn } = input;
  const adapter = config.adapters.vad;

  if (!adapter) return () => {};

  adapter.start({
    speechStart: () => sendBack({ type: "vad-speech-start" }),
    speechEnd: (duration) => sendBack({ type: "vad-speech-end", duration }),
    speechProbability: (value) => sendBack({ type: "vad-probability", value }),
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  });

  receive((event) => {
    if (event.type === "audio-input-chunk") {
      adapter.processAudio(event.audio);
    }
  });

  return () => adapter.stop();
});
