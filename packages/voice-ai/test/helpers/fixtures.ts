/**
 * Test Fixtures
 *
 * Predefined test data for audio formats, messages, and audio chunks.
 */

import type { AudioFormat, Message } from "../../src";

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO FORMAT FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 32,
};

export const LOW_QUALITY_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
};

export const HIGH_QUALITY_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 48000,
  channels: 2,
  bitDepth: 32,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an audio chunk with optional sample values.
 * @param samples - Array of sample values (defaults to [0.1, 0.2, 0.3])
 */
export function createAudioChunk(samples: number[] = [0.1, 0.2, 0.3]): Float32Array {
  return new Float32Array(samples);
}

/**
 * Create a silence chunk (all zeros).
 * @param length - Number of samples
 */
export function createSilenceChunk(length: number): Float32Array {
  return new Float32Array(length);
}

/**
 * Create a noise chunk (random values between -1 and 1).
 * @param length - Number of samples
 */
export function createNoiseChunk(length: number): Float32Array {
  const chunk = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    chunk[i] = Math.random() * 2 - 1;
  }
  return chunk;
}

/**
 * Create a sine wave chunk.
 * @param length - Number of samples
 * @param frequency - Frequency in Hz (relative to sample rate)
 * @param amplitude - Amplitude (0-1)
 */
export function createSineWaveChunk(
  length: number,
  frequency: number = 440,
  amplitude: number = 0.5,
): Float32Array {
  const chunk = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    chunk[i] =
      amplitude * Math.sin((2 * Math.PI * frequency * i) / DEFAULT_AUDIO_FORMAT.sampleRate);
  }
  return chunk;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELAY HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wait for a short time to allow events to propagate.
 * @param ms - Milliseconds to wait (defaults to 10)
 */
export function tick(ms: number = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
