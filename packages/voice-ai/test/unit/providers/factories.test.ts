/**
 * Unit Tests: Provider Factory Functions
 *
 * Tests for the custom provider factory functions.
 */

import { describe, expect, it, vi } from "vitest";
import {
  createCustomLLMProvider,
  createCustomSTTProvider,
  createCustomTTSProvider,
  createCustomTurnDetectorProvider,
  createCustomVADProvider,
} from "../../../src/providers/factories";

describe("createCustomSTTProvider", () => {
  it("creates a valid STT provider with required properties", () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const sendAudioMock = vi.fn();

    const provider = createCustomSTTProvider({
      name: "TestSTT",
      start: startMock,
      stop: stopMock,
      sendAudio: sendAudioMock,
    });

    expect(provider.metadata.name).toBe("TestSTT");
    expect(provider.metadata.type).toBe("stt");
    expect(provider.start).toBe(startMock);
    expect(provider.stop).toBe(stopMock);
    expect(provider.sendAudio).toBe(sendAudioMock);
  });

  it("uses default version 1.0.0 when not provided", () => {
    const provider = createCustomSTTProvider({
      name: "TestSTT",
      start: vi.fn(),
      stop: vi.fn(),
      sendAudio: vi.fn(),
    });

    expect(provider.metadata.version).toBe("1.0.0");
  });

  it("uses custom version when provided", () => {
    const provider = createCustomSTTProvider({
      name: "TestSTT",
      version: "2.5.0",
      start: vi.fn(),
      stop: vi.fn(),
      sendAudio: vi.fn(),
    });

    expect(provider.metadata.version).toBe("2.5.0");
  });

  it("methods are callable", () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const sendAudioMock = vi.fn();

    const provider = createCustomSTTProvider({
      name: "TestSTT",
      start: startMock,
      stop: stopMock,
      sendAudio: sendAudioMock,
    });

    const mockCtx = {
      audioFormat: { sampleRate: 24000 as const, channels: 1 as const, bitDepth: 32 as const },
      transcript: vi.fn(),
      speechStart: vi.fn(),
      speechEnd: vi.fn(),
      error: vi.fn(),
      signal: new AbortController().signal,
    };

    provider.start(mockCtx);
    expect(startMock).toHaveBeenCalledWith(mockCtx);

    provider.stop();
    expect(stopMock).toHaveBeenCalled();

    const audio = new Float32Array([0.1, 0.2]);
    provider.sendAudio(audio);
    expect(sendAudioMock).toHaveBeenCalledWith(audio);
  });
});

describe("createCustomLLMProvider", () => {
  it("creates a valid LLM provider with required properties", () => {
    const generateMock = vi.fn();

    const provider = createCustomLLMProvider({
      name: "TestLLM",
      generate: generateMock,
    });

    expect(provider.metadata.name).toBe("TestLLM");
    expect(provider.metadata.type).toBe("llm");
    expect(provider.generate).toBe(generateMock);
  });

  it("uses default version 1.0.0 when not provided", () => {
    const provider = createCustomLLMProvider({
      name: "TestLLM",
      generate: vi.fn(),
    });

    expect(provider.metadata.version).toBe("1.0.0");
  });

  it("uses custom version when provided", () => {
    const provider = createCustomLLMProvider({
      name: "TestLLM",
      version: "3.0.0",
      generate: vi.fn(),
    });

    expect(provider.metadata.version).toBe("3.0.0");
  });

  it("generate method is callable with messages and context", () => {
    const generateMock = vi.fn();

    const provider = createCustomLLMProvider({
      name: "TestLLM",
      generate: generateMock,
    });

    const messages = [{ role: "user" as const, content: "Hello" }];
    const mockCtx = {
      messages,
      say: vi.fn(),
      interrupt: vi.fn(),
      isSpeaking: vi.fn().mockReturnValue(false),
      token: vi.fn(),
      sentence: vi.fn(),
      complete: vi.fn(),
      error: vi.fn(),
      signal: new AbortController().signal,
    };

    provider.generate(messages, mockCtx);
    expect(generateMock).toHaveBeenCalledWith(messages, mockCtx);
  });
});

describe("createCustomTTSProvider", () => {
  it("creates a valid TTS provider with required properties", () => {
    const synthesizeMock = vi.fn();

    const provider = createCustomTTSProvider({
      name: "TestTTS",
      synthesize: synthesizeMock,
    });

    expect(provider.metadata.name).toBe("TestTTS");
    expect(provider.metadata.type).toBe("tts");
    expect(provider.synthesize).toBe(synthesizeMock);
  });

  it("uses default version 1.0.0 when not provided", () => {
    const provider = createCustomTTSProvider({
      name: "TestTTS",
      synthesize: vi.fn(),
    });

    expect(provider.metadata.version).toBe("1.0.0");
  });

  it("uses custom version when provided", () => {
    const provider = createCustomTTSProvider({
      name: "TestTTS",
      version: "1.2.3",
      synthesize: vi.fn(),
    });

    expect(provider.metadata.version).toBe("1.2.3");
  });

  it("synthesize method is callable with text and context", () => {
    const synthesizeMock = vi.fn();

    const provider = createCustomTTSProvider({
      name: "TestTTS",
      synthesize: synthesizeMock,
    });

    const mockCtx = {
      audioFormat: { sampleRate: 24000 as const, channels: 1 as const, bitDepth: 32 as const },
      audioChunk: vi.fn(),
      complete: vi.fn(),
      error: vi.fn(),
      signal: new AbortController().signal,
    };

    provider.synthesize("Hello world", mockCtx);
    expect(synthesizeMock).toHaveBeenCalledWith("Hello world", mockCtx);
  });
});

describe("createCustomVADProvider", () => {
  it("creates a valid VAD provider with required properties", () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const processAudioMock = vi.fn();

    const provider = createCustomVADProvider({
      name: "TestVAD",
      start: startMock,
      stop: stopMock,
      processAudio: processAudioMock,
    });

    expect(provider.metadata.name).toBe("TestVAD");
    expect(provider.metadata.type).toBe("vad");
    expect(provider.start).toBe(startMock);
    expect(provider.stop).toBe(stopMock);
    expect(provider.processAudio).toBe(processAudioMock);
  });

  it("uses default version 1.0.0 when not provided", () => {
    const provider = createCustomVADProvider({
      name: "TestVAD",
      start: vi.fn(),
      stop: vi.fn(),
      processAudio: vi.fn(),
    });

    expect(provider.metadata.version).toBe("1.0.0");
  });

  it("uses custom version when provided", () => {
    const provider = createCustomVADProvider({
      name: "TestVAD",
      version: "0.9.0",
      start: vi.fn(),
      stop: vi.fn(),
      processAudio: vi.fn(),
    });

    expect(provider.metadata.version).toBe("0.9.0");
  });

  it("methods are callable", () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const processAudioMock = vi.fn();

    const provider = createCustomVADProvider({
      name: "TestVAD",
      start: startMock,
      stop: stopMock,
      processAudio: processAudioMock,
    });

    const mockCtx = {
      speechStart: vi.fn(),
      speechEnd: vi.fn(),
      speechProbability: vi.fn(),
      signal: new AbortController().signal,
    };

    provider.start(mockCtx);
    expect(startMock).toHaveBeenCalledWith(mockCtx);

    provider.stop();
    expect(stopMock).toHaveBeenCalled();

    const audio = new Float32Array([0.1, 0.2]);
    provider.processAudio(audio);
    expect(processAudioMock).toHaveBeenCalledWith(audio);
  });
});

describe("createCustomTurnDetectorProvider", () => {
  it("creates a valid Turn Detector provider with required properties", () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const onSpeechEndMock = vi.fn();
    const onTranscriptMock = vi.fn();

    const provider = createCustomTurnDetectorProvider({
      name: "TestTurnDetector",
      start: startMock,
      stop: stopMock,
      onSpeechEnd: onSpeechEndMock,
      onTranscript: onTranscriptMock,
    });

    expect(provider.metadata.name).toBe("TestTurnDetector");
    expect(provider.metadata.type).toBe("turn-detector");
    expect(provider.start).toBe(startMock);
    expect(provider.stop).toBe(stopMock);
    expect(provider.onSpeechEnd).toBe(onSpeechEndMock);
    expect(provider.onTranscript).toBe(onTranscriptMock);
  });

  it("uses default version 1.0.0 when not provided", () => {
    const provider = createCustomTurnDetectorProvider({
      name: "TestTurnDetector",
      start: vi.fn(),
      stop: vi.fn(),
      onSpeechEnd: vi.fn(),
      onTranscript: vi.fn(),
    });

    expect(provider.metadata.version).toBe("1.0.0");
  });

  it("uses custom version when provided", () => {
    const provider = createCustomTurnDetectorProvider({
      name: "TestTurnDetector",
      version: "4.0.0-beta",
      start: vi.fn(),
      stop: vi.fn(),
      onSpeechEnd: vi.fn(),
      onTranscript: vi.fn(),
    });

    expect(provider.metadata.version).toBe("4.0.0-beta");
  });

  it("methods are callable", () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const onSpeechEndMock = vi.fn();
    const onTranscriptMock = vi.fn();

    const provider = createCustomTurnDetectorProvider({
      name: "TestTurnDetector",
      start: startMock,
      stop: stopMock,
      onSpeechEnd: onSpeechEndMock,
      onTranscript: onTranscriptMock,
    });

    const mockCtx = {
      turnEnd: vi.fn(),
      turnAbandoned: vi.fn(),
      signal: new AbortController().signal,
    };

    provider.start(mockCtx);
    expect(startMock).toHaveBeenCalledWith(mockCtx);

    provider.stop();
    expect(stopMock).toHaveBeenCalled();

    provider.onSpeechEnd(500);
    expect(onSpeechEndMock).toHaveBeenCalledWith(500);

    provider.onTranscript("Hello", true);
    expect(onTranscriptMock).toHaveBeenCalledWith("Hello", true);
  });
});
