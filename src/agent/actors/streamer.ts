/**
 * Audio Streamer Actor
 *
 * Handles audio streaming via the audio streamer adapter.
 * Receives audio chunks and streams them to the user.
 */

import { fromCallback } from "xstate";
import type { ResolvedAgentConfig } from "../../types/config";
import type { AgentEvent } from "../../types/events";

export const audioStreamerActor = fromCallback<
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

  config.adapters.audioStreamer.start({
    streamEnd: () => sendBack({ type: "audio-output-end" }),
    error: (error) => sendBack({ type: "audio-output-error", error }),
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  });

  sendBack({ type: "audio-output-start" });

  receive((event) => {
    if (event.type === "audio-output-stream") {
      config.adapters.audioStreamer.stream(event.audio);
    }
  });

  return () => config.adapters.audioStreamer.stop();
});
