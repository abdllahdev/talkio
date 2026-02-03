import { describe, expect, it } from "vitest";
import { SimulatedClock, createActor } from "xstate";

import { agentMachine } from "../../src/agent/machine";
import { normalizeFormat } from "../../src/audio/types";
import type { NormalizedAgentConfig } from "../../src/types/config";
import {
  createFakeLLM,
  createFakeSTT,
  createFakeTTS,
  type FakeLLM,
  type FakeSTT,
  type FakeTTS,
} from "../helpers/fake-providers";

type MachineHarness = {
  actor: ReturnType<typeof createActor>;
  stt: FakeSTT;
  llm: FakeLLM;
  tts: FakeTTS;
};

function createMachineHarness(): MachineHarness {
  const stt = createFakeSTT();
  const llm = createFakeLLM();
  const tts = createFakeTTS();

  const audio = {
    input: normalizeFormat(stt.provider.metadata.defaultInputFormat),
    output: normalizeFormat(tts.provider.metadata.defaultOutputFormat),
  };

  const config: NormalizedAgentConfig = {
    stt: stt.provider,
    llm: llm.provider,
    tts: tts.provider,
    audio,
  };

  let controller: ReadableStreamDefaultController<ArrayBuffer> | null = null;
  const stream = new ReadableStream<ArrayBuffer>({
    start(streamController) {
      controller = streamController;
    },
  });
  const reader = stream.getReader();
  reader.releaseLock();

  const actor = createActor(agentMachine, {
    input: { config, audioStreamController: controller },
    clock: new SimulatedClock(),
  });

  return { actor, stt, llm, tts };
}

describe("agent machine transitions", () => {
  it("starts in idle and transitions to running", () => {
    const { actor } = createMachineHarness();

    expect(actor.getSnapshot().value).toBe("idle");

    actor.start();
    actor.send({ type: "_agent:start", timestamp: 0 });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("running")).toBe(true);

    const value = snapshot.value;
    if (typeof value === "object" && value !== null && "running" in value) {
      const running = value.running as Record<string, unknown>;
      expect(Object.keys(running)).toEqual(
        expect.arrayContaining(["listening", "transcribing", "responding", "streaming"]),
      );
    }
  });

  it("transitions to stopped on stop", () => {
    const { actor } = createMachineHarness();

    actor.start();
    actor.send({ type: "_agent:start", timestamp: 0 });
    actor.send({ type: "_agent:stop", timestamp: 10 });

    const snapshot = actor.getSnapshot();
    expect(snapshot.status).toBe("done");
  });
});
