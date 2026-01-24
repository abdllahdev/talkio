/**
 * Test Fixtures
 *
 * Predefined test data for audio formats, messages, and audio chunks.
 */

import type { Message, NormalizedAudioConfig, NormalizedAudioFormat } from "../../src";

export const DEFAULT_AUDIO_FORMAT: NormalizedAudioFormat = {
  sampleRate: 24000,
  channels: 1,
  encoding: "linear16",
};

export const LOW_QUALITY_AUDIO_FORMAT: NormalizedAudioFormat = {
  sampleRate: 16000,
  channels: 1,
  encoding: "linear16",
};

export const HIGH_QUALITY_AUDIO_FORMAT: NormalizedAudioFormat = {
  sampleRate: 48000,
  channels: 2,
  encoding: "linear16",
};

export const TELEPHONY_AUDIO_FORMAT: NormalizedAudioFormat = {
  sampleRate: 8000,
  channels: 1,
  encoding: "mulaw",
};

export const DEFAULT_AUDIO_CONFIG: NormalizedAudioConfig = {
  input: DEFAULT_AUDIO_FORMAT,
  output: DEFAULT_AUDIO_FORMAT,
};

export const LOW_QUALITY_AUDIO_CONFIG: NormalizedAudioConfig = {
  input: LOW_QUALITY_AUDIO_FORMAT,
  output: LOW_QUALITY_AUDIO_FORMAT,
};

export const HIGH_QUALITY_AUDIO_CONFIG: NormalizedAudioConfig = {
  input: HIGH_QUALITY_AUDIO_FORMAT,
  output: HIGH_QUALITY_AUDIO_FORMAT,
};

export const MIXED_AUDIO_CONFIG: NormalizedAudioConfig = {
  input: LOW_QUALITY_AUDIO_FORMAT,
  output: DEFAULT_AUDIO_FORMAT,
};

export const singleUserMessage: Message[] = [{ role: "user", content: "Hello, how are you?" }];

export const singleAssistantMessage: Message[] = [
  { role: "assistant", content: "I'm doing well, thank you!" },
];

export const multiTurnConversation: Message[] = [
  { role: "user", content: "What's the weather today?" },
  { role: "assistant", content: "It's sunny and warm." },
  { role: "user", content: "Will it rain tomorrow?" },
  { role: "assistant", content: "No rain expected." },
];

export const conversationWithSystemMessage: Message[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello!" },
  { role: "assistant", content: "Hi there! How can I help you?" },
];

/**
 * Create an audio chunk as ArrayBuffer.
 * Creates a simple ArrayBuffer with the given number of bytes.
 */
export function createAudioChunk(byteLength: number = 6): ArrayBuffer {
  return new ArrayBuffer(byteLength);
}

/**
 * Create a silence chunk (all zeros) as ArrayBuffer.
 * @param byteLength - Number of bytes
 */
export function createSilenceChunk(byteLength: number): ArrayBuffer {
  return new ArrayBuffer(byteLength);
}

/**
 * Create a noise chunk (random bytes) as ArrayBuffer.
 * @param byteLength - Number of bytes
 */
export function createNoiseChunk(byteLength: number): ArrayBuffer {
  const buffer = new ArrayBuffer(byteLength);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < byteLength; i++) {
    view[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

/**
 * Wait for a short time to allow events to propagate.
 * @param ms - Milliseconds to wait (defaults to 10)
 */
export function tick(ms: number = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
