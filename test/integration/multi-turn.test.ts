/**
 * Integration Tests: Multi-turn Conversations
 *
 * Tests for conversation history maintenance across multiple turns.
 */

import { describe, expect, it } from "vitest";
import { createAgent, type AgentEvent } from "../../src";
import {
  createCapturingSTTProvider,
  createCapturingLLMProvider,
  createCapturingTTSProvider,
  tick,
} from "../helpers";

describe("multi-turn conversations", () => {
  it("maintains conversation history across multiple turns", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    const sttCtx = stt.getCtx();

    // ─── Turn 1: User asks about weather ───
    sttCtx.speechStart();
    sttCtx.transcript("What's the weather?", true);
    await tick();

    let llmCtx = llm.getCtx();
    llmCtx.sentence("It's sunny.", 0);
    llmCtx.complete("It's sunny.");

    // Complete TTS to end the turn
    let ttsCtx = tts.getCtx();
    ttsCtx.complete();
    await tick();

    // ─── Turn 2: User asks follow-up ───
    sttCtx.speechStart();
    sttCtx.transcript("Will it rain tomorrow?", true);
    await tick();

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
    await tick();

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

  it("LLM receives complete history on each turn", async () => {
    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
    });

    agent.start();
    await tick();

    const sttCtx = stt.getCtx();

    // Turn 1
    sttCtx.speechStart();
    sttCtx.transcript("First question", true);
    await tick();

    expect(llm.getMessages()).toHaveLength(1);

    let llmCtx = llm.getCtx();
    llmCtx.sentence("First answer", 0);
    llmCtx.complete("First answer");
    tts.getCtx().complete();
    await tick();

    // Turn 2
    sttCtx.speechStart();
    sttCtx.transcript("Second question", true);
    await tick();

    expect(llm.getMessages()).toHaveLength(3);

    llmCtx = llm.getCtx();
    llmCtx.sentence("Second answer", 0);
    llmCtx.complete("Second answer");
    tts.getCtx().complete();
    await tick();

    // Turn 3
    sttCtx.speechStart();
    sttCtx.transcript("Third question", true);
    await tick();

    expect(llm.getMessages()).toHaveLength(5);

    agent.stop();
  });

  it("handles rapid sequential turns", async () => {
    const events: AgentEvent[] = [];

    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
      onEvent: (event) => events.push(event),
    });

    agent.start();
    await tick();

    const sttCtx = stt.getCtx();

    // Multiple turns in quick succession
    for (let i = 1; i <= 3; i++) {
      sttCtx.speechStart();
      sttCtx.transcript(`Question ${i}`, true);
      await tick();

      const llmCtx = llm.getCtx();
      llmCtx.sentence(`Answer ${i}`, 0);
      llmCtx.complete(`Answer ${i}`);
      tts.getCtx().complete();
      await tick();
    }

    // Verify all messages were captured
    const snapshot = agent.getSnapshot();
    expect(snapshot.messages).toHaveLength(6);

    // Verify correct order
    expect(snapshot.messages.map((m) => m.content)).toEqual([
      "Question 1",
      "Answer 1",
      "Question 2",
      "Answer 2",
      "Question 3",
      "Answer 3",
    ]);

    agent.stop();
  });

  it("preserves message roles correctly", async () => {
    const stt = createCapturingSTTProvider();
    const llm = createCapturingLLMProvider();
    const tts = createCapturingTTSProvider();

    const agent = createAgent({
      stt: stt.provider,
      llm: llm.provider,
      tts: tts.provider,
    });

    agent.start();
    await tick();

    const sttCtx = stt.getCtx();

    // Turn 1
    sttCtx.speechStart();
    sttCtx.transcript("User message", true);
    await tick();

    const llmCtx = llm.getCtx();
    llmCtx.sentence("Assistant response", 0);
    llmCtx.complete("Assistant response");
    tts.getCtx().complete();
    await tick();

    // Verify roles
    const snapshot = agent.getSnapshot();
    expect(snapshot.messages[0].role).toBe("user");
    expect(snapshot.messages[1].role).toBe("assistant");

    agent.stop();
  });
});
