/**
 * TTS (Text-to-Speech) Actor
 *
 * Handles speech synthesis via the TTS adapter.
 * Converts text to audio chunks.
 */

import { fromCallback } from "xstate";
import type { ResolvedAgentConfig } from "../../types/config";
import type { AgentEvent } from "../../types/events";

export const ttsActor = fromCallback<
  AgentEvent,
  {
    config: ResolvedAgentConfig;
    text: string;
    abortSignal: AbortSignal;
    sayFn: (text: string) => void;
    interruptFn: () => void;
    isSpeakingFn: () => boolean;
  }
>(({ sendBack, input }) => {
  const { config, text, abortSignal, sayFn, interruptFn, isSpeakingFn } = input;

  config.adapters.tts.synthesize(text, {
    audioChunk: (audio) => sendBack({ type: "tts-chunk", audio }),
    complete: () => sendBack({ type: "tts-complete" }),
    error: (error) => sendBack({ type: "tts-error", error }),
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  });

  return () => config.adapters.tts.cancel();
});
