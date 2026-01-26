/**
 * Unit Tests: LLM Actor
 *
 * Tests for the Language Model actor in isolation.
 * Note: Event emission is tested via integration tests since XState's
 * fromCallback actors use sendBack which requires a parent actor.
 */

import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

import type { LLMContext, LLMFunction, LLMInput, LLMProvider, Message } from "../../../src";
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

    const provider: LLMProvider = {
      metadata: { name: "TestLLM", version: "1.0.0", type: "llm" },
      generate: generateMock,
    };

    return {
      provider,
      getCtx: () => capturedCtx,
      getMessages: () => capturedMessages,
      mocks: { generate: generateMock },
    };
  };

  const createTestConfig = (llm: LLMInput) => ({
    stt: mockSTTProvider,
    llm,
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

  describe("function-based provider", () => {
    const createTestLLMFunction = () => {
      let capturedCtx: LLMContext | null = null;
      const fn: LLMFunction = vi.fn((ctx: LLMContext) => {
        capturedCtx = ctx;
      });

      return {
        fn,
        getCtx: () => capturedCtx,
        mock: fn as ReturnType<typeof vi.fn>,
      };
    };

    it("calls function with context including messages", () => {
      const llm = createTestLLMFunction();
      const config = createTestConfig(llm.fn);
      const input = createTestInput(config, singleUserMessage);

      const actor = createActor(llmActor, { input });
      actor.start();

      expect(llm.mock).toHaveBeenCalledTimes(1);
      const ctx = llm.getCtx();
      expect(ctx).not.toBeNull();
      expect(ctx?.messages).toEqual(singleUserMessage);
    });

    it("provides context methods for event emission", () => {
      const llm = createTestLLMFunction();
      const config = createTestConfig(llm.fn);
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

    it("passes abort signal for cancellation", () => {
      const llm = createTestLLMFunction();
      const config = createTestConfig(llm.fn);
      const abortController = new AbortController();
      const input = {
        ...createTestInput(config),
        abortSignal: abortController.signal,
      };

      const actor = createActor(llmActor, { input });
      actor.start();

      const ctx = llm.getCtx();
      expect(ctx?.signal).toBe(abortController.signal);
      expect(ctx?.signal.aborted).toBe(false);

      abortController.abort();
      expect(ctx?.signal.aborted).toBe(true);
    });

    it("provides orchestration methods (say, interrupt, isSpeaking)", () => {
      const llm = createTestLLMFunction();
      const config = createTestConfig(llm.fn);
      const sayFn = vi.fn();
      const interruptFn = vi.fn();
      const isSpeakingFn = vi.fn(() => true);
      const input = {
        ...createTestInput(config),
        sayFn,
        interruptFn,
        isSpeakingFn,
      };

      const actor = createActor(llmActor, { input });
      actor.start();

      const ctx = llm.getCtx();
      if (!ctx) throw new Error("LLM context not captured");

      ctx.say("Let me think...");
      expect(sayFn).toHaveBeenCalledWith("Let me think...");

      ctx.interrupt();
      expect(interruptFn).toHaveBeenCalled();

      const result = ctx.isSpeaking();
      expect(isSpeakingFn).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("cleanup does not throw for function-based provider", () => {
      const llm = createTestLLMFunction();
      const config = createTestConfig(llm.fn);
      const input = createTestInput(config);

      const actor = createActor(llmActor, { input });
      actor.start();

      expect(() => actor.stop()).not.toThrow();
    });
  });
});
