/**
 * Test Mock Providers
 *
 * Mock implementations of providers for testing.
 * Includes both simple mocks and capturing adapters that expose contexts.
 */

import { vi, type Mock } from "vitest";
import type {
  LLMContext,
  LLMProvider,
  Message,
  STTContext,
  STTProvider,
  TTSContext,
  TTSProvider,
  TurnDetectorContext,
  TurnDetectorProvider,
  VADContext,
  VADProvider,
} from "../../src";

// ═══════════════════════════════════════════════════════════════════════════════
// CAPTURING PROVIDERS (expose contexts for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CapturingSTTProvider {
  provider: STTProvider;
  getCtx(): STTContext;
  mocks: {
    sendAudio: Mock;
    stop: Mock;
  };
}

export function createCapturingSTTProvider(): CapturingSTTProvider {
  let ctx: STTContext | null = null;
  const sendAudioMock = vi.fn();
  const stopMock = vi.fn();

  return {
    provider: {
      metadata: { name: "TestSTT", version: "1.0.0", type: "stt" as const },
      start: (c: STTContext) => {
        ctx = c;
      },
      stop: stopMock,
      sendAudio: sendAudioMock,
    },
    getCtx: () => {
      if (!ctx) throw new Error("STT context not captured - call provider.start() first");
      return ctx;
    },
    mocks: { sendAudio: sendAudioMock, stop: stopMock },
  };
}

export interface CapturingLLMProvider {
  provider: LLMProvider;
  getCtx(): LLMContext;
  getMessages(): Message[];
  mocks: {
    cancel: Mock;
  };
}

export function createCapturingLLMProvider(): CapturingLLMProvider {
  let ctx: LLMContext | null = null;
  let lastMessages: Message[] = [];
  const cancelMock = vi.fn();

  return {
    provider: {
      metadata: { name: "TestLLM", version: "1.0.0", type: "llm" as const },
      generate: (messages: Message[], c: LLMContext) => {
        ctx = c;
        lastMessages = messages;
      },
      cancel: cancelMock,
    },
    getCtx: () => {
      if (!ctx) throw new Error("LLM context not captured - call provider.generate() first");
      return ctx;
    },
    getMessages: () => lastMessages,
    mocks: { cancel: cancelMock },
  };
}

export interface CapturingTTSProvider {
  provider: TTSProvider;
  getCtx(): TTSContext;
  getLastText(): string;
  mocks: {
    cancel: Mock;
  };
}

export function createCapturingTTSProvider(): CapturingTTSProvider {
  let ctx: TTSContext | null = null;
  let lastText: string = "";
  const cancelMock = vi.fn();

  return {
    provider: {
      metadata: { name: "TestTTS", version: "1.0.0", type: "tts" as const },
      synthesize: (text: string, c: TTSContext) => {
        ctx = c;
        lastText = text;
      },
      cancel: cancelMock,
    },
    getCtx: () => {
      if (!ctx) throw new Error("TTS context not captured - call provider.synthesize() first");
      return ctx;
    },
    getLastText: () => lastText,
    mocks: { cancel: cancelMock },
  };
}

export interface CapturingVADProvider {
  provider: VADProvider;
  getCtx(): VADContext;
  mocks: {
    processAudio: Mock;
    stop: Mock;
  };
}

export function createCapturingVADProvider(): CapturingVADProvider {
  let ctx: VADContext | null = null;
  const processAudioMock = vi.fn();
  const stopMock = vi.fn();

  return {
    provider: {
      metadata: { name: "TestVAD", version: "1.0.0", type: "vad" as const },
      start: (c: VADContext) => {
        ctx = c;
      },
      stop: stopMock,
      processAudio: processAudioMock,
    },
    getCtx: () => {
      if (!ctx) throw new Error("VAD context not captured - call provider.start() first");
      return ctx;
    },
    mocks: { processAudio: processAudioMock, stop: stopMock },
  };
}

export interface CapturingTurnDetectorProvider {
  provider: TurnDetectorProvider;
  getCtx(): TurnDetectorContext;
  mocks: {
    onTranscript: Mock;
    onSpeechEnd: Mock;
    stop: Mock;
  };
}

export function createCapturingTurnDetectorProvider(): CapturingTurnDetectorProvider {
  let ctx: TurnDetectorContext | null = null;
  const onTranscriptMock = vi.fn();
  const onSpeechEndMock = vi.fn();
  const stopMock = vi.fn();

  return {
    provider: {
      metadata: { name: "TestTurnDetector", version: "1.0.0", type: "turn-detector" as const },
      start: (c: TurnDetectorContext) => {
        ctx = c;
      },
      stop: stopMock,
      onTranscript: onTranscriptMock,
      onSpeechEnd: onSpeechEndMock,
    },
    getCtx: () => {
      if (!ctx) throw new Error("TurnDetector context not captured - call provider.start() first");
      return ctx;
    },
    mocks: { onTranscript: onTranscriptMock, onSpeechEnd: onSpeechEndMock, stop: stopMock },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE MOCK PROVIDERS (no capturing, just stubs)
// ═══════════════════════════════════════════════════════════════════════════════

export const mockSTTProvider: STTProvider = {
  metadata: { name: "MockSTT", version: "1.0.0", type: "stt" },
  start: () => {},
  stop: () => {},
  sendAudio: () => {},
};

export const mockLLMProvider: LLMProvider = {
  metadata: { name: "MockLLM", version: "1.0.0", type: "llm" },
  generate: () => {},
  cancel: () => {},
};

export const mockTTSProvider: TTSProvider = {
  metadata: { name: "MockTTS", version: "1.0.0", type: "tts" },
  synthesize: () => {},
  cancel: () => {},
};

export const mockVADProvider: VADProvider = {
  metadata: { name: "MockVAD", version: "1.0.0", type: "vad" },
  start: () => {},
  stop: () => {},
  processAudio: () => {},
};

export const mockTurnDetectorProvider: TurnDetectorProvider = {
  metadata: { name: "MockTurnDetector", version: "1.0.0", type: "turn-detector" },
  start: () => {},
  stop: () => {},
  onTranscript: () => {},
  onSpeechEnd: () => {},
};
