/**
 * Audio Streamer Actor
 *
 * Internal actor that handles audio output streaming.
 * Receives audio chunks and pushes them to the ReadableStream controller.
 * Handles cancellation via abort signal for proper barge-in support.
 */

import { fromCallback } from "xstate";
import type { MachineEvent } from "../../types/events";

export const audioStreamerActor = fromCallback<
  MachineEvent,
  {
    audioStreamController: ReadableStreamDefaultController<Float32Array> | null;
    abortSignal: AbortSignal;
  }
>(({ sendBack, receive, input }) => {
  const { audioStreamController, abortSignal } = input;

  let isAborted = false;

  const handleAbort = () => {
    isAborted = true;
    sendBack({ type: "_audio:output-end" });
  };

  abortSignal.addEventListener("abort", handleAbort);

  sendBack({ type: "_audio:output-start" });

  receive((event) => {
    if (isAborted) return;

    if (event.type === "_audio:output-chunk") {
      if (audioStreamController) {
        try {
          audioStreamController.enqueue(event.audio);
        } catch {
          // Stream may be closed, ignore
        }
      }
    }
  });

  return () => {
    abortSignal.removeEventListener("abort", handleAbort);
  };
});
