/**
 * LLM (Large Language Model) Actor
 *
 * Handles response generation via the LLM provider or function.
 * Streams tokens and sentences from the language model.
 */

import { fromCallback } from "xstate";
import { isLLMProvider } from "../../providers/types";
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

  // Build the context object (same for both provider and function)
  const ctx = {
    messages,
    token: (token: string) => sendBack({ type: "_llm:token", token }),
    sentence: (sentence: string, index: number) =>
      sendBack({ type: "_llm:sentence", sentence, index }),
    complete: (fullText: string) => sendBack({ type: "_llm:complete", fullText }),
    error: (error: Error) => sendBack({ type: "_llm:error", error }),
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  };

  if (isLLMProvider(config.llm)) {
    config.llm.generate(messages, ctx);
  } else {
    config.llm(ctx);
  }
});
