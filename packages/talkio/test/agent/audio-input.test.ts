import { describe, expect, it } from "vitest";

import { float32ToLinear16 } from "../../src/audio/conversions";
import { createAgentHarness } from "../helpers/harness";

const audioConfig = {
  input: { encoding: "linear16", sampleRate: 16000, channels: 1 },
  output: { encoding: "linear16", sampleRate: 24000, channels: 1 },
} as const;

describe("audio input normalization", () => {
  it("normalizes Float32Array input to linear16", async () => {
    const harness = createAgentHarness({ audio: audioConfig });
    const { agent, events, stt } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    const float32 = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const expected = new Int16Array(float32ToLinear16(float32));

    agent.sendAudio(float32);

    expect(stt.receivedAudio.length).toBe(1);
    const received = new Int16Array(stt.receivedAudio[0]);
    expect(received).toEqual(expected);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("preserves Int16Array input for linear16", async () => {
    const harness = createAgentHarness({ audio: audioConfig });
    const { agent, events, stt } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    const int16 = new Int16Array([1, -2, 3, -4]);
    agent.sendAudio(int16);

    expect(stt.receivedAudio.length).toBe(1);
    expect(new Int16Array(stt.receivedAudio[0])).toEqual(int16);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("normalizes Uint8Array input to configured encoding", async () => {
    const harness = createAgentHarness({ audio: audioConfig });
    const { agent, events, stt } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    const bytes = new Uint8Array([1, 2, 3, 4]);
    agent.sendAudio(bytes);

    expect(stt.receivedAudio.length).toBe(1);
    expect(new Uint8Array(stt.receivedAudio[0])).toEqual(bytes);

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("normalizes Buffer input to configured encoding", async () => {
    const harness = createAgentHarness({ audio: audioConfig });
    const { agent, events, stt } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    const buffer = Buffer.from([5, 6, 7]);
    agent.sendAudio(buffer);

    expect(stt.receivedAudio.length).toBe(1);
    expect(new Uint8Array(stt.receivedAudio[0])).toEqual(new Uint8Array(buffer));

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });

  it("rejects Blob input with a guidance error", async () => {
    const harness = createAgentHarness({ audio: audioConfig });
    const { agent, events } = harness;

    agent.start();
    await events.waitForEvent("agent:started");

    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    expect(() => agent.sendAudio(blob)).toThrow(
      "Blob input requires async conversion. Use `await blob.arrayBuffer()` before calling sendAudio()",
    );

    agent.stop();
    await events.waitForEvent("agent:stopped");
  });
});
