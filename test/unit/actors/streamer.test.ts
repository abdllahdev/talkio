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
    } as unknown as ReadableStreamDefaultController<Float32Array>;

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

      const audioChunk = createAudioChunk([0.1, 0.2, 0.3]);
      actor.send({ type: "_audio:output-chunk", audio: audioChunk });

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

      const chunk1 = createAudioChunk([0.1, 0.2]);
      const chunk2 = createAudioChunk([0.3, 0.4]);
      const chunk3 = createAudioChunk([0.5, 0.6]);

      actor.send({ type: "_audio:output-chunk", audio: chunk1 });
      actor.send({ type: "_audio:output-chunk", audio: chunk2 });
      actor.send({ type: "_audio:output-chunk", audio: chunk3 });

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

      const audioChunk = createAudioChunk([0.1, 0.2, 0.3]);

      // Should not throw when controller is null
      expect(() => {
        actor.send({ type: "_audio:output-chunk", audio: audioChunk });
      }).not.toThrow();
    });

    it("handles closed stream gracefully", () => {
      const enqueueMock = vi.fn().mockImplementation(() => {
        throw new Error("Stream is closed");
      });

      const controller = {
        enqueue: enqueueMock,
        close: vi.fn(),
      } as unknown as ReadableStreamDefaultController<Float32Array>;

      const abortController = new AbortController();

      const actor = createActor(audioStreamerActor, {
        input: {
          audioStreamController: controller,
          abortSignal: abortController.signal,
        },
      });

      actor.start();

      const audioChunk = createAudioChunk([0.1, 0.2, 0.3]);

      // Should not throw when stream is closed
      expect(() => {
        actor.send({ type: "_audio:output-chunk", audio: audioChunk });
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
      const chunk1 = createAudioChunk([0.1, 0.2]);
      actor.send({ type: "_audio:output-chunk", audio: chunk1 });
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);

      // Abort
      abortController.abort();

      // Send chunk after abort
      const chunk2 = createAudioChunk([0.3, 0.4]);
      actor.send({ type: "_audio:output-chunk", audio: chunk2 });

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
