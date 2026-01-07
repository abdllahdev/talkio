/**
 * LLM (Large Language Model) Actor
 *
 * Handles response generation via the LLM adapter.
 * Streams tokens and sentences from the language model.
 */

import { fromCallback } from "xstate";
import type { Message } from "../../types/common";
import type { ResolvedAgentConfig } from "../../types/config";
import type { AgentEvent } from "../../types/events";

export const llmActor = fromCallback<
  AgentEvent,
  {
    config: ResolvedAgentConfig;
    messages: Message[];
    abortSignal: AbortSignal;
    sayFn: (text: string) => void;
    interruptFn: () => void;
    isSpeakingFn: () => boolean;
  }
>(({ sendBack, input }) => {
  const { config, messages, abortSignal, sayFn, interruptFn, isSpeakingFn } = input;

  config.adapters.llm.generate(messages, {
    token: (token) => sendBack({ type: "llm-token", token }),
    sentence: (sentence, index) => sendBack({ type: "llm-sentence", sentence, index }),
    complete: (fullText) => sendBack({ type: "llm-complete", fullText }),
    error: (error) => sendBack({ type: "llm-error", error }),
    say: sayFn,
    interrupt: interruptFn,
    isSpeaking: isSpeakingFn,
    signal: abortSignal,
  });

  return () => config.adapters.llm.cancel();
});
