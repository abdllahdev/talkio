/**
 * STT (Speech-to-Text) Actor
 *
 * Handles speech recognition via the STT adapter.
 * Receives audio input and emits transcript events.
 */

import { fromCallback } from "xstate";
import type { ResolvedAgentConfig } from "../../types/config";
import type { AgentEvent } from "../../types/events";

export const sttActor = fromCallback<
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
  const adapter = config.adapters.stt;

  adapter.start({
    transcript: (text, isFinal) => {
      if (isFinal) {
        sendBack({ type: "stt-transcript-final", text });
      } else {
        sendBack({ type: "stt-transcript-partial", text });
      }
    },
    speechStart: () => {
      sendBack({ type: "stt-speech-start" });
    },
    speechEnd: () => {
      sendBack({ type: "stt-speech-end" });
    },
    error: (error) => {
      sendBack({ type: "stt-error", error });
    },
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  });

  receive((event) => {
    if (event.type === "audio-input-chunk") {
      adapter.sendAudio(event.audio);
    }
  });

  return () => adapter.stop();
});
