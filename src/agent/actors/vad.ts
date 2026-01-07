/**
 * VAD (Voice Activity Detection) Actor
 *
 * Handles voice activity detection via the VAD provider.
 * Detects speech start/end and provides speech probability.
 */

import { fromCallback } from "xstate";
import type { AgentConfig } from "../../types/config";
import type { MachineEvent } from "../../types/events";

export const vadActor = fromCallback<
  MachineEvent,
  {
    config: AgentConfig;
    abortSignal: AbortSignal;
  }
>(({ sendBack, receive, input }) => {
  const { config, abortSignal } = input;
  const provider = config.vad;

  if (!provider) return () => {};

  provider.start({
    speechStart: () => sendBack({ type: "_vad:speech-start" }),
    speechEnd: (duration) => sendBack({ type: "_vad:speech-end", duration }),
    speechProbability: (value) => sendBack({ type: "_vad:probability", value }),
    signal: abortSignal,
  });

  receive((event) => {
    if (event.type === "_audio:input") {
      provider.processAudio(event.audio);
    }
  });

  return () => provider.stop();
});
