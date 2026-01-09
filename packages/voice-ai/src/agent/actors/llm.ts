/**
 * LLM (Large Language Model) Actor
 *
 * XState callback actor that handles response generation via the LLM provider or function.
 * This actor is responsible for:
 * - Invoking the LLM provider's `generate()` method or calling the LLM function
 * - Streaming tokens and sentences as they're generated
 * - Handling filler phrases and acknowledgments via `ctx.say()`
 * - Supporting interruption of current speech via `ctx.interrupt()`
 * - Emitting events for tokens, sentences, completion, and errors
 *
 * The actor receives the conversation history (messages) and an abort signal
 * for cancellation. It provides the LLM context with methods to report
 * generation progress and control speech playback.
 *
 * @module agent/actors/llm
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

  const ctx = {
    messages,
    token: (token: string) => sendBack({ type: "_llm:token", token, timestamp: Date.now() }),
    sentence: (sentence: string, index: number) =>
      sendBack({ type: "_llm:sentence", sentence, index, timestamp: Date.now() }),
    complete: (fullText: string) =>
      sendBack({ type: "_llm:complete", fullText, timestamp: Date.now() }),
    error: (error: Error) => sendBack({ type: "_llm:error", error, timestamp: Date.now() }),
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
