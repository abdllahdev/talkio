/**
 * Turn Detector Actor
 *
 * Handles turn detection via the turn detector provider.
 * Determines when the user has finished speaking and when turns are abandoned.
 */

import { fromCallback } from "xstate";
import type { AgentConfig } from "../../types/config";
import type { MachineEvent } from "../../types/events";

export const turnDetectorActor = fromCallback<
  MachineEvent,
  {
    config: AgentConfig;
    abortSignal: AbortSignal;
  }
>(({ sendBack, receive, input }) => {
  const { config, abortSignal } = input;
  const provider = config.turnDetector;

  if (!provider) return () => {};

  provider.start({
    turnEnd: (transcript) => sendBack({ type: "_turn:end", transcript }),
    turnAbandoned: (reason) => sendBack({ type: "_turn:abandoned", reason }),
    signal: abortSignal,
  });

  receive((event) => {
    if (event.type === "_stt:transcript") {
      provider.onTranscript(event.text, event.isFinal);
    } else if (event.type === "_vad:speech-end") {
      provider.onSpeechEnd(event.duration);
    }
  });

  return () => provider.stop();
});
