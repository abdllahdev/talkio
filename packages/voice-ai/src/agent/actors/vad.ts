/**
 * VAD (Voice Activity Detection) Actor
 *
 * XState callback actor that handles voice activity detection via the VAD provider.
 * This actor is responsible for:
 * - Starting the VAD provider (if configured)
 * - Receiving audio input chunks from the agent machine
 * - Processing audio through the VAD provider to detect speech
 * - Emitting speech start/end events for turn detection and interruption
 * - Emitting speech probability events for visualization
 * - Handling errors from the VAD provider
 * - Cleaning up the VAD provider when stopped
 *
 * VAD is optional - if not provided, the STT provider's built-in VAD is used
 * as a fallback. A dedicated VAD provider (like Silero) can provide faster
 * interruption detection for better user experience.
 *
 * @module agent/actors/vad
 */

import { fromCallback } from "xstate";
import type { NormalizedAgentConfig } from "../../types/config";
import type { MachineEvent } from "../../types/events";

export const vadActor = fromCallback<
  MachineEvent,
  {
    config: NormalizedAgentConfig;
    abortSignal: AbortSignal;
  }
>(({ sendBack, receive, input }) => {
  const { config, abortSignal } = input;
  const provider = config.vad;

  if (!provider) return () => {};

  provider.start({
    speechStart: () => sendBack({ type: "_vad:speech-start", timestamp: Date.now() }),
    speechEnd: (duration) => sendBack({ type: "_vad:speech-end", duration, timestamp: Date.now() }),
    speechProbability: (value) =>
      sendBack({ type: "_vad:probability", value, timestamp: Date.now() }),
    signal: abortSignal,
  });

  receive((event) => {
    if (event.type === "_audio:input") {
      provider.processAudio(event.audio);
    }
  });

  return () => provider.stop();
});
