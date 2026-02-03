/**
 * TTS (Text-to-Speech) Actor
 *
 * XState callback actor that handles speech synthesis via the TTS provider.
 * This actor is responsible for:
 * - Invoking the TTS provider's `synthesize()` method with the text to speak
 * - Receiving audio chunks as they're produced by the TTS provider
 * - Emitting audio chunk events for streaming playback
 * - Emitting completion events when synthesis finishes
 * - Handling errors from the TTS provider
 * - Respecting abort signals for cancellation
 *
 * The actor receives the text to synthesize, and the
 * configured output audio format. It streams audio chunks in real-time,
 * enabling low-latency playback while the TTS provider continues generating audio.
 *
 * @module agent/actors/tts
 */

import { fromCallback } from "xstate";

import type { NormalizedAgentConfig } from "../../types/config";
import type { MachineEvent } from "../../types/events";

export const ttsActor = fromCallback<
  MachineEvent,
  {
    config: NormalizedAgentConfig;
    text: string;
    abortSignal: AbortSignal;
  }
>(({ sendBack, input }) => {
  const { config, text, abortSignal } = input;
  const provider = config.tts;
  const outputFormat = config.audio.output;
  const debug = config.debug ?? false;

  let isAborted = false;

  const handleAbort = () => {
    isAborted = true;
  };

  abortSignal.addEventListener("abort", handleAbort);

  // Check if already aborted before starting
  if (abortSignal.aborted) {
    isAborted = true;
    return () => {
      abortSignal.removeEventListener("abort", handleAbort);
    };
  }

  // Set up timeout
  const timeoutMs = config.timeout?.ttsMs;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      if (!isAborted) {
        isAborted = true;
        if (debug) console.error("[tts-actor] Timeout after", timeoutMs, "ms");
        sendBack({
          type: "_tts:error",
          error: new Error(`TTS timeout after ${timeoutMs}ms`),
          timestamp: Date.now(),
        });
      }
    }, timeoutMs);
  }

  try {
    provider.synthesize(text, {
      audioFormat: outputFormat,
      audioChunk: (audio) => {
        if (isAborted) return;
        sendBack({ type: "_tts:chunk", audio, timestamp: Date.now() });
      },
      complete: () => {
        if (isAborted) return;
        if (timeoutId) clearTimeout(timeoutId);
        sendBack({ type: "_tts:complete", timestamp: Date.now() });
      },
      error: (error) => {
        if (isAborted) return;
        sendBack({ type: "_tts:error", error, timestamp: Date.now() });
      },
      signal: abortSignal,
    });
  } catch (error) {
    if (!isAborted) {
      if (debug) console.error("[tts-actor] Error starting synthesis:", error);
      sendBack({
        type: "_tts:error",
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
      });
    }
  }

  return () => {
    isAborted = true;
    if (timeoutId) clearTimeout(timeoutId);
    abortSignal.removeEventListener("abort", handleAbort);
  };
});
