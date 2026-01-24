/**
 * Unit Tests: Audio Input Types
 *
 * Tests for sendAudio accepting multiple input types.
 */

import { describe, expect, it } from "vitest";

import { createAgent } from "../../../src";
import { createCapturingSTTProvider, mockLLMProvider, mockTTSProvider, tick } from "../../helpers";

describe("audio input types", () => {
  it("accepts ArrayBuffer", async () => {
    const stt = createCapturingSTTProvider();
    const agent = createAgent({
      stt: stt.provider,
      llm: mockLLMProvider,
      tts: mockTTSProvider,
    });

    agent.start();
    await tick();

    const buffer = new ArrayBuffer(1024);
    agent.sendAudio(buffer);

    expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(1);
    expect(stt.mocks.sendAudio).toHaveBeenCalledWith(expect.any(ArrayBuffer));

    agent.stop();
  });

  it("accepts Float32Array (from AudioWorklet)", async () => {
    const stt = createCapturingSTTProvider();
    const agent = createAgent({
      stt: stt.provider,
      llm: mockLLMProvider,
      tts: mockTTSProvider,
    });

    agent.start();
    await tick();

    const float32 = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    agent.sendAudio(float32);

    expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(1);
    // Should be converted to ArrayBuffer
    const receivedBuffer = stt.mocks.sendAudio.mock.calls[0][0];
    expect(receivedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(receivedBuffer.byteLength).toBe(float32.byteLength);

    agent.stop();
  });

  it("accepts Int16Array (raw PCM samples)", async () => {
    const stt = createCapturingSTTProvider();
    const agent = createAgent({
      stt: stt.provider,
      llm: mockLLMProvider,
      tts: mockTTSProvider,
    });

    agent.start();
    await tick();

    const int16 = new Int16Array([100, 200, 300, 400]);
    agent.sendAudio(int16);

    expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(1);
    const receivedBuffer = stt.mocks.sendAudio.mock.calls[0][0];
    expect(receivedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(receivedBuffer.byteLength).toBe(int16.byteLength);

    agent.stop();
  });

  it("accepts Uint8Array", async () => {
    const stt = createCapturingSTTProvider();
    const agent = createAgent({
      stt: stt.provider,
      llm: mockLLMProvider,
      tts: mockTTSProvider,
    });

    agent.start();
    await tick();

    const uint8 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    agent.sendAudio(uint8);

    expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(1);
    const receivedBuffer = stt.mocks.sendAudio.mock.calls[0][0];
    expect(receivedBuffer).toBeInstanceOf(ArrayBuffer);
    expect(receivedBuffer.byteLength).toBe(uint8.byteLength);

    agent.stop();
  });

  it("creates a copy of typed array buffer", async () => {
    const stt = createCapturingSTTProvider();
    const agent = createAgent({
      stt: stt.provider,
      llm: mockLLMProvider,
      tts: mockTTSProvider,
    });

    agent.start();
    await tick();

    const original = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    agent.sendAudio(original);

    const receivedBuffer = stt.mocks.sendAudio.mock.calls[0][0];

    // Modify the original - should not affect the sent buffer
    original[0] = 999;

    // The received buffer should still have the original value
    const receivedFloat32 = new Float32Array(receivedBuffer);
    expect(receivedFloat32[0]).toBeCloseTo(0.1, 5);

    agent.stop();
  });

  it("handles typed array with offset and length", async () => {
    const stt = createCapturingSTTProvider();
    const agent = createAgent({
      stt: stt.provider,
      llm: mockLLMProvider,
      tts: mockTTSProvider,
    });

    agent.start();
    await tick();

    // Create a typed array that is a view into a larger buffer
    const largeBuffer = new ArrayBuffer(1024);
    const view = new Float32Array(largeBuffer, 256, 32); // offset 256 bytes, 32 elements
    view[0] = 0.5;
    view[31] = 0.75;

    agent.sendAudio(view);

    expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(1);
    const receivedBuffer = stt.mocks.sendAudio.mock.calls[0][0];
    expect(receivedBuffer.byteLength).toBe(view.byteLength); // Only the view's portion

    const receivedView = new Float32Array(receivedBuffer);
    expect(receivedView[0]).toBeCloseTo(0.5, 5);
    expect(receivedView[31]).toBeCloseTo(0.75, 5);

    agent.stop();
  });

  it("throws error for Blob input", () => {
    const stt = createCapturingSTTProvider();
    const agent = createAgent({
      stt: stt.provider,
      llm: mockLLMProvider,
      tts: mockTTSProvider,
    });

    agent.start();

    const blob = new Blob(["test"], { type: "audio/webm" });

    expect(() => agent.sendAudio(blob)).toThrow(/Blob.*async/);

    agent.stop();
  });
});
