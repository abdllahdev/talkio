/**
 * Audio Streamer Actor
 *
 * XState callback actor that handles audio output streaming to the agent's audio stream.
 * This actor is responsible for:
 * - Receiving audio chunk events from the TTS provider
 * - Enqueuing audio chunks to the ReadableStream controller
 * - Managing the audio stream lifecycle (start/end events)
 * - Handling abort signals to gracefully close the stream
 * - Ignoring chunks if the stream is already closed
 *
 * The actor acts as a bridge between the agent's internal audio events and
 * the public ReadableStream API, allowing consumers to read audio chunks
 * as they're produced by the TTS provider.
 *
 * @module agent/actors/streamer
 */

import { fromCallback } from "xstate";
import type { MachineEvent } from "../../types/events";

export const audioStreamerActor = fromCallback<
  MachineEvent,
  {
    audioStreamController: ReadableStreamDefaultController<ArrayBuffer> | null;
    abortSignal: AbortSignal;
  }
>(({ sendBack, receive, input }) => {
  const { audioStreamController, abortSignal } = input;

  let isAborted = false;

  const handleAbort = () => {
    isAborted = true;
    sendBack({ type: "_audio:output-end", timestamp: Date.now() });
  };

  abortSignal.addEventListener("abort", handleAbort);

  sendBack({ type: "_audio:output-start", timestamp: Date.now() });

  receive((event) => {
    if (isAborted) return;

    if (event.type === "_audio:output-chunk") {
      if (audioStreamController) {
        try {
          audioStreamController.enqueue(event.audio);
        } catch {
          // Ignore if stream is closed
        }
      }
    }
  });

  return () => {
    abortSignal.removeEventListener("abort", handleAbort);
  };
});
