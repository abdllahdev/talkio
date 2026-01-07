/**
 * LLM (Large Language Model) Actor
 *
 * Handles response generation via the LLM provider.
 * Streams tokens and sentences from the language model.
 */

import { fromCallback } from "xstate";
import type { Message } from "../../types/common";
import type { AgentConfig } from "../../types/config";
import type { MachineEvent } from "../../types/events";

export const llmActor = fromCallback<
  MachineEvent,
  {
    config: AgentConfig;
    messages: Message[];
    abortSignal: AbortSignal;
    sayFn: (text: string) => void;
    interruptFn: () => void;
    isSpeakingFn: () => boolean;
  }
>(({ sendBack, input }) => {
  const { config, messages, abortSignal, sayFn, interruptFn, isSpeakingFn } = input;

  config.llm.generate(messages, {
    token: (token) => sendBack({ type: "_llm:token", token }),
    sentence: (sentence, index) => sendBack({ type: "_llm:sentence", sentence, index }),
    complete: (fullText) => sendBack({ type: "_llm:complete", fullText }),
    error: (error) => sendBack({ type: "_llm:error", error }),
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  });

  return () => config.llm.cancel();
});
