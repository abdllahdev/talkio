/**
 * Unit Tests: Audio Streamer Actor
 *
 * Tests for the Audio Streamer actor in isolation.
 * Note: Some event emission tests are tested via integration tests since XState's
 * fromCallback actors use sendBack which requires a parent actor.
 */

import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

import { audioStreamerActor } from "../../../src/agent/actors/streamer";
import { createAudioChunk } from "../../helpers";

describe("audioStreamerActor", () => {
  const createMockController = () => {
    const enqueueMock = vi.fn();
    const closeMock = vi.fn();

    const controller = {
      enqueue: enqueueMock,
      close: closeMock,
    } as unknown as ReadableStreamDefaultController<ArrayBuffer>;

    return { controller, mocks: { enqueue: enqueueMock, close: closeMock } };
  };

  describe("audio chunk handling", () => {
    it("enqueues audio chunks to the stream controller", () => {
      const { controller, mocks } = createMockController();
      const abortController = new AbortController();

      const actor = createActor(audioStreamerActor, {
        input: {
          audioStreamController: controller,
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const audioChunk = createAudioChunk();
      actor.send({ type: "_audio:output-chunk", audio: audioChunk, timestamp: Date.now() });

      expect(mocks.enqueue).toHaveBeenCalledWith(audioChunk);
    });

    it("enqueues multiple audio chunks", () => {
      const { controller, mocks } = createMockController();
      const abortController = new AbortController();

      const actor = createActor(audioStreamerActor, {
        input: {
          audioStreamController: controller,
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const chunk1 = createAudioChunk();
      const chunk2 = createAudioChunk();
      const chunk3 = createAudioChunk();

      actor.send({ type: "_audio:output-chunk", audio: chunk1, timestamp: Date.now() });
      actor.send({ type: "_audio:output-chunk", audio: chunk2, timestamp: Date.now() });
      actor.send({ type: "_audio:output-chunk", audio: chunk3, timestamp: Date.now() });

      expect(mocks.enqueue).toHaveBeenCalledTimes(3);
      expect(mocks.enqueue).toHaveBeenNthCalledWith(1, chunk1);
      expect(mocks.enqueue).toHaveBeenNthCalledWith(2, chunk2);
      expect(mocks.enqueue).toHaveBeenNthCalledWith(3, chunk3);
    });

    it("handles null controller gracefully", () => {
      const abortController = new AbortController();

      const actor = createActor(audioStreamerActor, {
        input: {
          audioStreamController: null,
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const audioChunk = createAudioChunk();

      // Should not throw when controller is null
      expect(() => {
        actor.send({ type: "_audio:output-chunk", audio: audioChunk, timestamp: Date.now() });
      }).not.toThrow();
    });

    it("handles closed stream gracefully", () => {
      const enqueueMock = vi.fn().mockImplementation(() => {
        throw new Error("Stream is closed");
      });

      const controller = {
        enqueue: enqueueMock,
        close: vi.fn(),
      } as unknown as ReadableStreamDefaultController<ArrayBuffer>;

      const abortController = new AbortController();

      const actor = createActor(audioStreamerActor, {
        input: {
          audioStreamController: controller,
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const audioChunk = createAudioChunk();

      // Should not throw when stream is closed
      expect(() => {
        actor.send({ type: "_audio:output-chunk", audio: audioChunk, timestamp: Date.now() });
      }).not.toThrow();
    });
  });

  describe("abort handling", () => {
    it("stops processing audio chunks after abort", () => {
      const { controller, mocks } = createMockController();
      const abortController = new AbortController();

      const actor = createActor(audioStreamerActor, {
        input: {
          audioStreamController: controller,
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      // Send chunk before abort
      const chunk1 = createAudioChunk();
      actor.send({ type: "_audio:output-chunk", audio: chunk1, timestamp: Date.now() });
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);

      // Abort
      abortController.abort();

      // Send chunk after abort
      const chunk2 = createAudioChunk();
      actor.send({ type: "_audio:output-chunk", audio: chunk2, timestamp: Date.now() });

      // Should not have enqueued the second chunk
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup", () => {
    it("removes abort event listener on cleanup", () => {
      const { controller } = createMockController();
      const abortController = new AbortController();

      const removeEventListenerSpy = vi.spyOn(abortController.signal, "removeEventListener");

      const actor = createActor(audioStreamerActor, {
        input: {
          audioStreamController: controller,
          abortSignal: abortController.signal,
        },
      });

      actor.start();
      actor.stop();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    });
  });
});
