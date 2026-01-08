/**
 * Unit Tests: LLM Actor
 *
 * Tests for the Language Model actor in isolation.
 * Note: Event emission is tested via integration tests since XState's
 * fromCallback actors use sendBack which requires a parent actor.
 */

import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import type { LLMContext, LLMProvider, Message } from "../../../src";
import { llmActor } from "../../../src/agent/actors/llm";
import { mockSTTProvider, mockTTSProvider, singleUserMessage } from "../../helpers";

describe("llmActor", () => {
  const createTestLLMProvider = () => {
    let capturedCtx: LLMContext | null = null;
    let capturedMessages: Message[] = [];
    const generateMock = vi.fn((messages: Message[], ctx: LLMContext) => {
      capturedCtx = ctx;
      capturedMessages = messages;
    });
    const cancelMock = vi.fn();

    const provider: LLMProvider = {
      metadata: { name: "TestLLM", version: "1.0.0", type: "llm" },
      generate: generateMock,
      cancel: cancelMock,
    };

    return {
      provider,
      getCtx: () => capturedCtx,
      getMessages: () => capturedMessages,
      mocks: { generate: generateMock, cancel: cancelMock },
    };
  };

  const createTestConfig = (llmProvider: LLMProvider) => ({
    stt: mockSTTProvider,
    llm: llmProvider,
    tts: mockTTSProvider,
  });

  const createTestInput = (
    config: ReturnType<typeof createTestConfig>,
    messages: Message[] = singleUserMessage,
  ) => ({
    config,
    messages,
    abortSignal: new AbortController().signal,
    sayFn: vi.fn(),
    interruptFn: vi.fn(),
    isSpeakingFn: vi.fn(() => false),
  });

  describe("initialization", () => {
    it("calls provider.generate() with messages and context", () => {
      const llm = createTestLLMProvider();
      const config = createTestConfig(llm.provider);
      const input = createTestInput(config, singleUserMessage);

      const actor = createActor(llmActor, { input });
      actor.start();

      expect(llm.mocks.generate).toHaveBeenCalledTimes(1);
      expect(llm.getMessages()).toEqual(singleUserMessage);
      expect(llm.getCtx()).not.toBeNull();
    });

    it("passes abort signal to provider context", () => {
      const llm = createTestLLMProvider();
      const config = createTestConfig(llm.provider);
      const abortController = new AbortController();
      const input = {
        ...createTestInput(config),
        abortSignal: abortController.signal,
      };

      const actor = createActor(llmActor, { input });
      actor.start();

      expect(llm.getCtx()?.signal).toBe(abortController.signal);
    });

    it("provides context methods for event emission", () => {
      const llm = createTestLLMProvider();
      const config = createTestConfig(llm.provider);
      const input = createTestInput(config);

      const actor = createActor(llmActor, { input });
      actor.start();

      const ctx = llm.getCtx();
      if (!ctx) throw new Error("LLM context not captured");
      expect(typeof ctx.token).toBe("function");
      expect(typeof ctx.sentence).toBe("function");
      expect(typeof ctx.complete).toBe("function");
      expect(typeof ctx.error).toBe("function");
    });
  });

  describe("orchestration methods", () => {
    it("provides ctx.say() that calls sayFn", () => {
      const llm = createTestLLMProvider();
      const config = createTestConfig(llm.provider);
      const sayFn = vi.fn();
      const input = {
        ...createTestInput(config),
        sayFn,
      };

      const actor = createActor(llmActor, { input });
      actor.start();

      const ctx = llm.getCtx();
      if (!ctx) throw new Error("LLM context not captured");
      ctx.say("Let me think...");

      expect(sayFn).toHaveBeenCalledWith("Let me think...");
    });

    it("provides ctx.interrupt() that calls interruptFn", () => {
      const llm = createTestLLMProvider();
      const config = createTestConfig(llm.provider);
      const interruptFn = vi.fn();
      const input = {
        ...createTestInput(config),
        interruptFn,
      };

      const actor = createActor(llmActor, { input });
      actor.start();

      const ctx = llm.getCtx();
      if (!ctx) throw new Error("LLM context not captured");
      ctx.interrupt();

      expect(interruptFn).toHaveBeenCalled();
    });

    it("provides ctx.isSpeaking() that calls isSpeakingFn", () => {
      const llm = createTestLLMProvider();
      const config = createTestConfig(llm.provider);
      const isSpeakingFn = vi.fn(() => true);
      const input = {
        ...createTestInput(config),
        isSpeakingFn,
      };

      const actor = createActor(llmActor, { input });
      actor.start();

      const ctx = llm.getCtx();
      if (!ctx) throw new Error("LLM context not captured");
      const result = ctx.isSpeaking();

      expect(isSpeakingFn).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("cleanup", () => {
    it("calls provider.cancel() when actor is stopped", () => {
      const llm = createTestLLMProvider();
      const config = createTestConfig(llm.provider);
      const input = createTestInput(config);

      const actor = createActor(llmActor, { input });
      actor.start();

      expect(llm.mocks.cancel).not.toHaveBeenCalled();

      actor.stop();

      expect(llm.mocks.cancel).toHaveBeenCalledTimes(1);
    });
  });
});
