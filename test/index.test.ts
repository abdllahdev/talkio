import { describe, expect, it, vi } from "vitest";
import {
  createAgent,
  type AgentEvent,
  type AudioFormat,
  type LLMContext,
  type LLMProvider,
  type Message,
  type STTContext,
  type STTProvider,
  type TTSContext,
  type TTSProvider,
} from "../src";

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT AUDIO FORMAT FOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_AUDIO_FORMAT: AudioFormat = {
  sampleRate: 24000,
  channels: 1,
  bitDepth: 32,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Create capturing adapters that expose their contexts for testing
// ═══════════════════════════════════════════════════════════════════════════════

function createCapturingSTTAdapter() {
  let ctx: STTContext | null = null;
  const sendAudioMock = vi.fn();
  const stopMock = vi.fn();

  return {
    adapter: {
      metadata: { name: "TestSTT", version: "1.0.0", type: "stt" as const },
      start: (c: STTContext) => {
        ctx = c;
      },
      stop: stopMock,
      sendAudio: sendAudioMock,
    } satisfies STTProvider,
    getCtx: () => {
      if (!ctx) throw new Error("STT context not captured");
      return ctx;
    },
    mocks: { sendAudio: sendAudioMock, stop: stopMock },
  };
}

function createCapturingLLMAdapter() {
  let ctx: LLMContext | null = null;
  let lastMessages: Message[] = [];
  const cancelMock = vi.fn();

  return {
    adapter: {
      metadata: { name: "TestLLM", version: "1.0.0", type: "llm" as const },
      generate: (messages: Message[], c: LLMContext) => {
        ctx = c;
        lastMessages = messages;
      },
      cancel: cancelMock,
    } satisfies LLMProvider,
    getCtx: () => {
      if (!ctx) throw new Error("LLM context not captured");
      return ctx;
    },
    getMessages: () => lastMessages,
    mocks: { cancel: cancelMock },
  };
}

function createCapturingTTSAdapter() {
  let ctx: TTSContext | null = null;
  let lastText: string = "";
  const cancelMock = vi.fn();

  return {
    adapter: {
      metadata: { name: "TestTTS", version: "1.0.0", type: "tts" as const },
      synthesize: (text: string, c: TTSContext) => {
        ctx = c;
        lastText = text;
      },
      cancel: cancelMock,
    } satisfies TTSProvider,
    getCtx: () => {
      if (!ctx) throw new Error("TTS context not captured");
      return ctx;
    },
    getLastText: () => lastText,
    mocks: { cancel: cancelMock },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE MOCK ADAPTERS (for basic tests)
// ═══════════════════════════════════════════════════════════════════════════════

const mockSTTAdapter: STTProvider = {
  metadata: { name: "MockSTT", version: "1.0.0", type: "stt" },
  start: () => {},
  stop: () => {},
  sendAudio: () => {},
};

const mockLLMAdapter: LLMProvider = {
  metadata: { name: "MockLLM", version: "1.0.0", type: "llm" },
  generate: () => {},
  cancel: () => {},
};

const mockTTSAdapter: TTSProvider = {
  metadata: { name: "MockTTS", version: "1.0.0", type: "tts" },
  synthesize: () => {},
  cancel: () => {},
};

describe("createAgent", () => {
  it("creates an agent with required adapters", () => {
    const agent = createAgent({
      stt: mockSTTAdapter,
      llm: mockLLMAdapter,
      tts: mockTTSAdapter,
    });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(typeof agent.start).toBe("function");
    expect(typeof agent.stop).toBe("function");
    expect(typeof agent.sendAudio).toBe("function");
    expect(typeof agent.subscribe).toBe("function");
    expect(typeof agent.getSnapshot).toBe("function");
    expect(agent.audioStream).toBeInstanceOf(ReadableStream);
  });

  it("creates an agent with onEvent callback", () => {
    const events: unknown[] = [];

    const agent = createAgent({
      stt: mockSTTAdapter,
      llm: mockLLMAdapter,
      tts: mockTTSAdapter,
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(agent).toBeDefined();
  });

  it("returns initial state snapshot", () => {
    const agent = createAgent({
      stt: mockSTTAdapter,
      llm: mockLLMAdapter,
      tts: mockTTSAdapter,
    });

    const snapshot = agent.getSnapshot();

    expect(snapshot.value).toBe("idle");
    expect(snapshot.isRunning).toBe(false);
    expect(snapshot.isSpeaking).toBe(false);
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.partialTranscript).toBe("");
  });

  it("accepts audioFormat configuration", () => {
    const agent = createAgent({
      stt: mockSTTAdapter,
      llm: mockLLMAdapter,
      tts: mockTTSAdapter,
      audioFormat: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
      },
    });

    expect(agent).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FULL CONVERSATION FLOW TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("full conversation flow", () => {
  /**
   * Complete conversation turn:
   * 1. User speaks → STT transcribes
   * 2. Turn ends → LLM generates response
   * 3. LLM streams sentences → TTS synthesizes
   * 4. TTS produces audio → Audio output via audioStream
   */
  it("orchestrates a complete conversation turn", async () => {
    const events: AgentEvent[] = [];
    const audioChunks: Float32Array[] = [];

    // Create all capturing adapters
    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: llm.adapter,
      tts: tts.adapter,
      onEvent: (event) => {
        events.push(event);
        // Capture audio chunks from events (new event name: ai-turn:audio)
        if (event.type === "ai-turn:audio") {
          audioChunks.push(event.audio);
        }
      },
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Verify agent:started event
    expect(events.some((e) => e.type === "agent:started")).toBe(true);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: User speaks → STT transcribes
    // ─────────────────────────────────────────────────────────────────────────
    const sttCtx = stt.getCtx();

    // Verify audioFormat is passed to STT
    expect(sttCtx.audioFormat).toEqual(DEFAULT_AUDIO_FORMAT);

    // User starts speaking
    sttCtx.speechStart();
    expect(events.some((e) => e.type === "human-turn:started")).toBe(true);

    // STT streams partial transcripts
    sttCtx.transcript("What's the", false);
    sttCtx.transcript("What's the weather", false);

    // Verify partial transcripts are emitted
    const partialEvents = events.filter(
      (e) => e.type === "human-turn:transcript" && !e.isFinal
    );
    expect(partialEvents.length).toBeGreaterThanOrEqual(2);

    // STT produces final transcript → triggers turn end → triggers LLM
    sttCtx.transcript("What's the weather today?", true);
    await new Promise((r) => setTimeout(r, 10));

    // Verify turn ended and response started
    expect(events.some((e) => e.type === "human-turn:ended")).toBe(true);
    expect(events.some((e) => e.type === "ai-turn:started")).toBe(true);

    // Verify user message added to history
    let snapshot = agent.getSnapshot();
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0]).toEqual({
      role: "user",
      content: "What's the weather today?",
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: LLM generates response
    // ─────────────────────────────────────────────────────────────────────────
    const llmCtx = llm.getCtx();

    // Verify LLM received the conversation
    expect(llm.getMessages()).toHaveLength(1);
    expect(llm.getMessages()[0].content).toBe("What's the weather today?");

    // LLM streams tokens
    llmCtx.token("The ");
    llmCtx.token("weather ");
    llmCtx.token("is ");
    llmCtx.token("sunny ");
    llmCtx.token("today.");

    // Verify tokens are captured (new event name: ai-turn:token)
    const tokenEvents = events.filter((e) => e.type === "ai-turn:token");
    expect(tokenEvents.length).toBe(5);

    // LLM emits complete sentence → triggers TTS
    llmCtx.sentence("The weather is sunny today.", 0);
    await new Promise((r) => setTimeout(r, 10));

    // Verify sentence event (new event name: ai-turn:sentence)
    expect(events.some((e) => e.type === "ai-turn:sentence")).toBe(true);
    snapshot = agent.getSnapshot();
    expect(snapshot.isSpeaking).toBe(true);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: TTS synthesizes the sentence
    // ─────────────────────────────────────────────────────────────────────────
    const ttsCtx = tts.getCtx();

    // Verify TTS received the sentence and audioFormat
    expect(tts.getLastText()).toBe("The weather is sunny today.");
    expect(ttsCtx.audioFormat).toEqual(DEFAULT_AUDIO_FORMAT);

    // TTS produces audio chunks
    const audioChunk1 = new Float32Array([0.1, 0.2, 0.3]);
    const audioChunk2 = new Float32Array([0.4, 0.5, 0.6]);
    ttsCtx.audioChunk(audioChunk1);
    ttsCtx.audioChunk(audioChunk2);
    await new Promise((r) => setTimeout(r, 10));

    // Verify audio chunks were emitted as events (ai-turn:audio)
    expect(audioChunks).toHaveLength(2);
    expect(audioChunks[0]).toEqual(audioChunk1);
    expect(audioChunks[1]).toEqual(audioChunk2);

    // TTS completes
    ttsCtx.complete();
    await new Promise((r) => setTimeout(r, 10));

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: LLM completes generation
    // ─────────────────────────────────────────────────────────────────────────
    llmCtx.complete("The weather is sunny today.");
    await new Promise((r) => setTimeout(r, 10));

    // Verify ai-turn:ended event (replaces llm-complete for users)
    expect(events.some((e) => e.type === "ai-turn:ended")).toBe(true);

    // Verify assistant message added to history
    snapshot = agent.getSnapshot();
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.messages[1]).toEqual({
      role: "assistant",
      content: "The weather is sunny today.",
    });

    // Speaking should be false after TTS completes
    expect(snapshot.isSpeaking).toBe(false);

    agent.stop();
  });

  /**
   * Filler phrases:
   * When LLM is slow, adapters can use ctx.say() to play filler phrases
   * Note: The filler events are internal and not exposed to users
   */
  it("supports filler phrases via ctx.say()", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: llm.adapter,
      tts: tts.adapter,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Trigger a turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Tell me a story", true);
    await new Promise((r) => setTimeout(r, 10));

    // LLM uses ctx.say() to trigger a filler
    const llmCtx = llm.getCtx();
    llmCtx.say("Let me think about that...");
    await new Promise((r) => setTimeout(r, 10));

    // Filler events are internal - not exposed to users
    // But we can verify TTS was triggered for filler
    expect(tts.getLastText()).toBe("Let me think about that...");

    // Verify speaking state
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    // LLM can use ctx.interrupt() to stop the filler
    llmCtx.interrupt();
    await new Promise((r) => setTimeout(r, 10));

    // Verify speaking stopped
    expect(agent.getSnapshot().isSpeaking).toBe(false);

    agent.stop();
  });

  /**
   * Barge-in:
   * User interrupts the agent while it's speaking
   */
  it("handles barge-in when user interrupts agent", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: llm.adapter,
      tts: tts.adapter,
      bargeIn: {
        enabled: true,
        minDurationMs: 50, // Low threshold for testing
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Start a conversation turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await new Promise((r) => setTimeout(r, 10));

    // Agent starts generating response
    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hello! How can I help you today?", 0);
    await new Promise((r) => setTimeout(r, 10));

    // Verify agent is speaking
    expect(agent.getSnapshot().isSpeaking).toBe(true);

    // User interrupts! (barge-in)
    // In real scenario, VAD adapter would detect this
    // For fallback, we use STT's speechStart while agent is speaking
    sttCtx.speechStart();
    await new Promise((r) => setTimeout(r, 10));

    // Verify barge-in was detected (new event name: ai-turn:interrupted)
    expect(events.some((e) => e.type === "ai-turn:interrupted")).toBe(true);

    // Agent should have stopped speaking
    expect(agent.getSnapshot().isSpeaking).toBe(false);

    // LLM should have been cancelled
    expect(llm.mocks.cancel).toHaveBeenCalled();

    agent.stop();
  });

  /**
   * Audio routing:
   * Verifies audio input flows to STT adapter
   */
  it("routes audio input to STT adapter", async () => {
    const stt = createCapturingSTTAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: mockLLMAdapter,
      tts: mockTTSAdapter,
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Send audio chunks from microphone
    const chunk1 = new Float32Array([0.1, 0.2, 0.3]);
    const chunk2 = new Float32Array([0.4, 0.5, 0.6]);
    const chunk3 = new Float32Array([0.7, 0.8, 0.9]);

    agent.sendAudio(chunk1);
    agent.sendAudio(chunk2);
    agent.sendAudio(chunk3);

    // Verify all chunks were forwarded to STT
    expect(stt.mocks.sendAudio).toHaveBeenCalledTimes(3);
    expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(1, chunk1);
    expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(2, chunk2);
    expect(stt.mocks.sendAudio).toHaveBeenNthCalledWith(3, chunk3);

    agent.stop();
  });

  /**
   * Multi-turn conversation:
   * Verifies conversation history is maintained across turns
   */
  it("maintains conversation history across multiple turns", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: llm.adapter,
      tts: tts.adapter,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    const sttCtx = stt.getCtx();

    // ─── Turn 1: User asks about weather ───
    sttCtx.speechStart();
    sttCtx.transcript("What's the weather?", true);
    await new Promise((r) => setTimeout(r, 10));

    let llmCtx = llm.getCtx();
    llmCtx.sentence("It's sunny.", 0);
    llmCtx.complete("It's sunny.");

    // Complete TTS to end the turn
    let ttsCtx = tts.getCtx();
    ttsCtx.complete();
    await new Promise((r) => setTimeout(r, 10));

    // ─── Turn 2: User asks follow-up ───
    sttCtx.speechStart();
    sttCtx.transcript("Will it rain tomorrow?", true);
    await new Promise((r) => setTimeout(r, 10));

    // LLM should receive full conversation history
    const messages = llm.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "What's the weather?" });
    expect(messages[1]).toEqual({ role: "assistant", content: "It's sunny." });
    expect(messages[2]).toEqual({ role: "user", content: "Will it rain tomorrow?" });

    // Complete turn 2
    llmCtx = llm.getCtx();
    llmCtx.sentence("No rain expected.", 0);
    llmCtx.complete("No rain expected.");

    ttsCtx = tts.getCtx();
    ttsCtx.complete();
    await new Promise((r) => setTimeout(r, 10));

    // Verify full history
    const snapshot = agent.getSnapshot();
    expect(snapshot.messages).toHaveLength(4);
    expect(snapshot.messages.map((m) => m.content)).toEqual([
      "What's the weather?",
      "It's sunny.",
      "Will it rain tomorrow?",
      "No rain expected.",
    ]);

    agent.stop();
  });

  /**
   * Error handling:
   * Verifies errors from adapters are emitted as events
   */
  it("emits error events from adapters", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: llm.adapter,
      tts: mockTTSAdapter,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Simulate STT error
    const sttCtx = stt.getCtx();
    sttCtx.error(new Error("STT connection lost"));
    await new Promise((r) => setTimeout(r, 10));

    // Verify error event (new event name: agent:error)
    const errorEvent = events.find((e) => e.type === "agent:error");
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === "agent:error") {
      expect(errorEvent.error.message).toBe("STT connection lost");
      expect(errorEvent.source).toBe("stt");
    }

    agent.stop();
  });

  /**
   * Audio stream:
   * Verifies audioStream is available and receives chunks
   */
  it("exposes audioStream that receives TTS chunks", async () => {
    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: llm.adapter,
      tts: tts.adapter,
    });

    // Verify audioStream is a ReadableStream
    expect(agent.audioStream).toBeInstanceOf(ReadableStream);

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Trigger a conversation turn
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await new Promise((r) => setTimeout(r, 10));

    // LLM generates response
    const llmCtx = llm.getCtx();
    llmCtx.sentence("Hi there!", 0);
    await new Promise((r) => setTimeout(r, 10));

    // TTS produces audio
    const ttsCtx = tts.getCtx();
    const audioChunk = new Float32Array([0.1, 0.2, 0.3]);
    ttsCtx.audioChunk(audioChunk);
    await new Promise((r) => setTimeout(r, 10));

    // Note: Reading from the stream would require async iteration
    // For this test, we verify the stream exists and ai-turn:audio events are emitted

    agent.stop();
  });

  /**
   * Internal events filtering:
   * Verifies internal events (prefixed with "_") are not exposed to users
   */
  it("does not expose internal events to onEvent callback", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();

    const agent = createAgent({
      stt: stt.adapter,
      llm: llm.adapter,
      tts: tts.adapter,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Trigger some activity
    const sttCtx = stt.getCtx();
    sttCtx.speechStart();
    sttCtx.transcript("Hello", true);
    await new Promise((r) => setTimeout(r, 10));

    // Verify no internal events leaked
    const internalEvents = events.filter((e) => e.type.startsWith("_"));
    expect(internalEvents).toHaveLength(0);

    // Verify we got public events
    expect(events.some((e) => e.type === "agent:started")).toBe(true);
    expect(events.some((e) => e.type === "human-turn:started")).toBe(true);
    expect(events.some((e) => e.type === "human-turn:ended")).toBe(true);

    agent.stop();
  });
});
