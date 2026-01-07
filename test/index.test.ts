import { describe, expect, it, vi } from "vitest";
import {
  createAgent,
  type AgentEvent,
  type AudioStreamerAdapter,
  type AudioStreamerContext,
  type LLMAdapter,
  type LLMContext,
  type Message,
  type STTAdapter,
  type STTContext,
  type TTSAdapter,
  type TTSContext,
} from "../src";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Create capturing adapters that expose their contexts for testing
// ═══════════════════════════════════════════════════════════════════════════════

function createCapturingSTTAdapter() {
  let ctx: STTContext | null = null;
  const sendAudioMock = vi.fn();
  const stopMock = vi.fn();

  return {
    adapter: {
      start: (c: STTContext) => {
        ctx = c;
      },
      stop: stopMock,
      sendAudio: sendAudioMock,
    } satisfies STTAdapter,
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
      generate: (messages: Message[], c: LLMContext) => {
        ctx = c;
        lastMessages = messages;
      },
      cancel: cancelMock,
    } satisfies LLMAdapter,
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
      synthesize: (text: string, c: TTSContext) => {
        ctx = c;
        lastText = text;
      },
      cancel: cancelMock,
    } satisfies TTSAdapter,
    getCtx: () => {
      if (!ctx) throw new Error("TTS context not captured");
      return ctx;
    },
    getLastText: () => lastText,
    mocks: { cancel: cancelMock },
  };
}

function createCapturingAudioStreamerAdapter() {
  let ctx: AudioStreamerContext | null = null;
  const streamMock = vi.fn();
  const stopMock = vi.fn();

  return {
    adapter: {
      start: (c: AudioStreamerContext) => {
        ctx = c;
      },
      stream: streamMock,
      stop: stopMock,
    } satisfies AudioStreamerAdapter,
    getCtx: () => {
      if (!ctx) throw new Error("AudioOutput context not captured");
      return ctx;
    },
    mocks: { stream: streamMock, stop: stopMock },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE MOCK ADAPTERS (for basic tests)
// ═══════════════════════════════════════════════════════════════════════════════

const mockSTTAdapter: STTAdapter = {
  start: () => {},
  stop: () => {},
  sendAudio: () => {},
};

const mockLLMAdapter: LLMAdapter = {
  generate: () => {},
  cancel: () => {},
};

const mockTTSAdapter: TTSAdapter = {
  synthesize: () => {},
  cancel: () => {},
};

const mockAudioStreamerAdapter: AudioStreamerAdapter = {
  start: () => {},
  stream: () => {},
  stop: () => {},
};

describe("createAgent", () => {
  it("creates an agent with required adapters", () => {
    const agent = createAgent({
      adapters: {
        stt: mockSTTAdapter,
        llm: mockLLMAdapter,
        tts: mockTTSAdapter,
        audioStreamer: mockAudioStreamerAdapter,
      },
    });

    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(typeof agent.start).toBe("function");
    expect(typeof agent.stop).toBe("function");
    expect(typeof agent.sendAudio).toBe("function");
    expect(typeof agent.subscribe).toBe("function");
    expect(typeof agent.getSnapshot).toBe("function");
  });

  it("creates an agent with onEvent callback", () => {
    const events: unknown[] = [];

    const agent = createAgent({
      adapters: {
        stt: mockSTTAdapter,
        llm: mockLLMAdapter,
        tts: mockTTSAdapter,
        audioStreamer: mockAudioStreamerAdapter,
      },
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(agent).toBeDefined();
  });

  it("returns initial state snapshot", () => {
    const agent = createAgent({
      adapters: {
        stt: mockSTTAdapter,
        llm: mockLLMAdapter,
        tts: mockTTSAdapter,
        audioStreamer: mockAudioStreamerAdapter,
      },
    });

    const snapshot = agent.getSnapshot();

    expect(snapshot.value).toBe("idle");
    expect(snapshot.isRunning).toBe(false);
    expect(snapshot.isSpeaking).toBe(false);
    expect(snapshot.messages).toEqual([]);
    expect(snapshot.partialTranscript).toBe("");
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
   * 4. TTS produces audio → Audio output plays
   */
  it("orchestrates a complete conversation turn", async () => {
    const events: AgentEvent[] = [];

    // Create all capturing adapters
    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();
    const audioStreamer = createCapturingAudioStreamerAdapter();

    const agent = createAgent({
      adapters: {
        stt: stt.adapter,
        llm: llm.adapter,
        tts: tts.adapter,
        audioStreamer: audioStreamer.adapter,
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: User speaks → STT transcribes
    // ─────────────────────────────────────────────────────────────────────────
    const sttCtx = stt.getCtx();

    // User starts speaking
    sttCtx.speechStart();
    expect(events.some((e) => e.type === "stt-speech-start")).toBe(true);
    expect(events.some((e) => e.type === "human-turn-start")).toBe(true);

    // STT streams partial transcripts
    sttCtx.transcript("What's the", false);
    sttCtx.transcript("What's the weather", false);

    // STT produces final transcript → triggers turn end → triggers LLM
    sttCtx.transcript("What's the weather today?", true);
    await new Promise((r) => setTimeout(r, 10));

    // Verify turn ended and response started
    expect(events.some((e) => e.type === "human-turn-end")).toBe(true);
    expect(events.some((e) => e.type === "ai-turn-start")).toBe(true);

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

    // Verify tokens are captured
    const tokenEvents = events.filter((e) => e.type === "llm-token");
    expect(tokenEvents.length).toBe(5);

    // LLM emits complete sentence → triggers TTS
    llmCtx.sentence("The weather is sunny today.", 0);
    await new Promise((r) => setTimeout(r, 10));

    // Verify sentence event and speaking state
    expect(events.some((e) => e.type === "llm-sentence")).toBe(true);
    snapshot = agent.getSnapshot();
    expect(snapshot.isSpeaking).toBe(true);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: TTS synthesizes the sentence
    // ─────────────────────────────────────────────────────────────────────────
    const ttsCtx = tts.getCtx();

    // Verify TTS received the sentence
    expect(tts.getLastText()).toBe("The weather is sunny today.");

    // TTS produces audio chunks
    const audioChunk1 = new Float32Array([0.1, 0.2, 0.3]);
    const audioChunk2 = new Float32Array([0.4, 0.5, 0.6]);
    ttsCtx.audioChunk(audioChunk1);
    ttsCtx.audioChunk(audioChunk2);

    // Verify audio was forwarded to output
    expect(audioStreamer.mocks.stream).toHaveBeenCalledTimes(2);
    expect(audioStreamer.mocks.stream).toHaveBeenCalledWith(audioChunk1);
    expect(audioStreamer.mocks.stream).toHaveBeenCalledWith(audioChunk2);

    // TTS completes
    ttsCtx.complete();

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: LLM completes generation
    // ─────────────────────────────────────────────────────────────────────────
    llmCtx.complete("The weather is sunny today.");
    await new Promise((r) => setTimeout(r, 10));

    // Verify response:end event
    expect(events.some((e) => e.type === "llm-complete")).toBe(true);

    // Verify assistant message added to history
    snapshot = agent.getSnapshot();
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.messages[1]).toEqual({
      role: "assistant",
      content: "The weather is sunny today.",
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Audio streaming completes
    // ─────────────────────────────────────────────────────────────────────────
    const audioCtx = audioStreamer.getCtx();
    audioCtx.streamEnd();
    await new Promise((r) => setTimeout(r, 10));

    // Speaking should be false after streaming
    snapshot = agent.getSnapshot();
    expect(snapshot.isSpeaking).toBe(false);

    agent.stop();
  });

  /**
   * Filler phrases:
   * When LLM is slow, adapters can use ctx.say() to play filler phrases
   */
  it("supports filler phrases via ctx.say()", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTAdapter();
    const llm = createCapturingLLMAdapter();
    const tts = createCapturingTTSAdapter();
    const audioStreamer = createCapturingAudioStreamerAdapter();

    const agent = createAgent({
      adapters: {
        stt: stt.adapter,
        llm: llm.adapter,
        tts: tts.adapter,
        audioStreamer: audioStreamer.adapter,
      },
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

    // Verify say event
    const sayEvent = events.find((e) => e.type === "say");
    expect(sayEvent).toBeDefined();
    if (sayEvent?.type === "say") {
      expect(sayEvent.text).toBe("Let me think about that...");
    }

    // Verify TTS was triggered for filler
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
    const audioStreamer = createCapturingAudioStreamerAdapter();

    const agent = createAgent({
      adapters: {
        stt: stt.adapter,
        llm: llm.adapter,
        tts: tts.adapter,
        audioStreamer: audioStreamer.adapter,
      },
      config: {
        bargeIn: {
          enabled: true,
          minDurationMs: 50, // Low threshold for testing
        },
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

    // Verify barge-in was detected
    expect(events.some((e) => e.type === "ai-turn-interrupted")).toBe(true);

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
      adapters: {
        stt: stt.adapter,
        llm: mockLLMAdapter,
        tts: mockTTSAdapter,
        audioStreamer: mockAudioStreamerAdapter,
      },
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
    const audioStreamer = createCapturingAudioStreamerAdapter();

    const agent = createAgent({
      adapters: {
        stt: stt.adapter,
        llm: llm.adapter,
        tts: tts.adapter,
        audioStreamer: audioStreamer.adapter,
      },
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
      adapters: {
        stt: stt.adapter,
        llm: llm.adapter,
        tts: mockTTSAdapter,
        audioStreamer: mockAudioStreamerAdapter,
      },
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await new Promise((r) => setTimeout(r, 10));

    // Simulate STT error
    const sttCtx = stt.getCtx();
    sttCtx.error(new Error("STT connection lost"));
    await new Promise((r) => setTimeout(r, 10));

    // Verify error event
    const errorEvent = events.find((e) => e.type === "stt-error");
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === "stt-error") {
      expect(errorEvent.error.message).toBe("STT connection lost");
    }

    agent.stop();
  });
});
