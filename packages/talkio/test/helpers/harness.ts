import { type Agent, createAgent } from "../../src/agent/create-agent";
import type { AudioConfig } from "../../src/audio/types";
import type { InterruptionConfig, TimeoutConfig } from "../../src/types/config";
import { createTestClock } from "./clock";
import { createEventCapture } from "./event-capture";
import {
  createFakeLLM,
  createFakeSTT,
  createFakeTTS,
  createFakeTurnDetector,
  createFakeVAD,
  type FakeLLM,
  type FakeSTT,
  type FakeTTS,
  type FakeTurnDetector,
  type FakeVAD,
} from "./fake-providers";

type HarnessOptions = {
  useVAD?: boolean;
  useTurnDetector?: boolean;
  interruption?: InterruptionConfig;
  timeout?: TimeoutConfig;
  audio?: AudioConfig;
  maxMessages?: number;
  debug?: boolean;
};

type AgentHarness = {
  agent: Agent;
  stt: FakeSTT;
  llm: FakeLLM;
  tts: FakeTTS;
  vad?: FakeVAD;
  turnDetector?: FakeTurnDetector;
  events: ReturnType<typeof createEventCapture>;
  advance: (ms: number) => void;
  stop: () => void;
};

export function createAgentHarness(options: HarnessOptions = {}): AgentHarness {
  const stt = createFakeSTT();
  const llm = createFakeLLM();
  const tts = createFakeTTS();
  const vad = options.useVAD ? createFakeVAD() : undefined;
  const turnDetector = options.useTurnDetector ? createFakeTurnDetector() : undefined;
  const events = createEventCapture();
  const { clock, advance } = createTestClock();

  const agent = createAgent({
    stt: stt.provider,
    llm: llm.provider,
    tts: tts.provider,
    vad: vad?.provider,
    turnDetector: turnDetector?.provider,
    interruption: options.interruption,
    timeout: options.timeout,
    audio: options.audio,
    maxMessages: options.maxMessages,
    debug: options.debug,
    simulatedClock: clock,
    onEvent: events.onEvent,
  });

  return {
    agent,
    stt,
    llm,
    tts,
    vad,
    turnDetector,
    events,
    advance,
    stop: () => agent.stop(),
  };
}

export async function drainMicrotasks(): Promise<void> {
  await Promise.resolve();
}

export type { AgentHarness, HarnessOptions };
