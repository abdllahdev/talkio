/**
 * Turn Detector Actor
 *
 * XState callback actor that handles turn detection via the turn detector provider.
 * This actor is responsible for:
 * - Starting the turn detector provider (if configured)
 * - Receiving transcript updates from the STT provider
 * - Receiving speech end events from VAD
 * - Analyzing transcripts and speech patterns to detect turn boundaries
 * - Emitting turn end events when the user has finished speaking
 * - Emitting turn abandoned events for short/noise turns
 * - Handling errors from the turn detector provider
 * - Cleaning up the turn detector provider when stopped
 *
 * Turn detection is optional - if not provided, the STT provider's final
 * transcript marks the turn end. A dedicated turn detector can provide
 * faster or more sophisticated turn detection (e.g., semantic analysis).
 *
 * @module agent/actors/turn-detector
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
    turnEnd: (transcript) => sendBack({ type: "_turn:end", transcript, timestamp: Date.now() }),
    turnAbandoned: (reason) => sendBack({ type: "_turn:abandoned", reason, timestamp: Date.now() }),
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
