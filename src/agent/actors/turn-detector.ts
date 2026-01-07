/**
 * Turn Detector Actor
 *
 * Handles turn detection via the turn detector adapter.
 * Determines when the user has finished speaking and when turns are abandoned.
 */

import { fromCallback } from "xstate";
import type { ResolvedAgentConfig } from "../../types/config";
import type { AgentEvent } from "../../types/events";

export const turnDetectorActor = fromCallback<
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
  const adapter = config.adapters.turnDetector;

  if (!adapter) return () => {};

  adapter.start({
    turnEnd: (transcript) => sendBack({ type: "turn-end", transcript }),
    turnAbandoned: (reason) => sendBack({ type: "turn-abandoned", reason }),
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  });

  receive((event) => {
    if (event.type === "stt-transcript-partial") {
      adapter.onTranscript(event.text, false);
    } else if (event.type === "stt-transcript-final") {
      adapter.onTranscript(event.text, true);
    } else if (event.type === "vad-speech-end") {
      adapter.onSpeechEnd(event.duration);
    }
  });

  return () => adapter.stop();
});
