/**
 * Simple Voice Agent Example
 *
 * This example demonstrates how to create a voice agent using:
 * - Deepgram for STT (Speech-to-Text) and TTS (Text-to-Speech)
 * - Vercel AI SDK for the LLM
 *
 * Prerequisites:
 * - DEEPGRAM_API_KEY environment variable
 * - OPENAI_API_KEY environment variable (for AI SDK with OpenAI)
 */

import { openai } from "@ai-sdk/openai";
import { createDeepgram } from "@voice-ai/deepgram";
import { streamText } from "ai";
import { createAgent, type LLMContext } from "voice-ai";

const deepgram = createDeepgram({
  apiKey: process.env.DEEPGRAM_API_KEY,
});

const llm = async (ctx: LLMContext) => {
  try {
    const result = streamText({
      model: openai("gpt-4o-mini"),
      messages: ctx.messages,
      abortSignal: ctx.signal,
    });

    let fullText = "";
    let sentenceBuffer = "";
    let sentenceIndex = 0;

    for await (const chunk of result.textStream) {
      ctx.token(chunk);
      fullText += chunk;
      sentenceBuffer += chunk;

      const sentenceEnders = /[.!?]\s+/g;
      let match;
      let lastIndex = 0;

      while ((match = sentenceEnders.exec(sentenceBuffer)) !== null) {
        const sentence = sentenceBuffer.slice(lastIndex, match.index + 1).trim();
        if (sentence) {
          ctx.sentence(sentence, sentenceIndex++);
        }
        lastIndex = match.index + match[0].length;
      }

      sentenceBuffer = sentenceBuffer.slice(lastIndex);
    }

    if (sentenceBuffer.trim()) {
      ctx.sentence(sentenceBuffer.trim(), sentenceIndex);
    }

    ctx.complete(fullText);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
    ctx.error(error instanceof Error ? error : new Error(String(error)));
  }
};

const agent = createAgent({
  stt: deepgram.stt({ model: "nova-3" }),
  llm,
  tts: deepgram.tts({ model: "aura-2-thalia-en" }),
});

agent.start();

export { agent };
