/**
 * Create Agent
 *
 * Public function for creating a voice agent.
 */

import { nanoid } from "nanoid";
import { createActor } from "xstate";
import type { AgentMachineOutput, Message } from "../types/common";
import { resolveConfig, type AgentConfig } from "../types/config";
import { agentMachine } from "./machine";

/**
 * Voice agent instance.
 * Provides methods to control the agent and send audio data.
 */
export interface Agent {
  /** Unique identifier for this agent instance */
  readonly id: string;

  /**
   * Start the agent.
   * Initializes STT, VAD, and other adapters.
   */
  start(): void;

  /**
   * Send audio data to the agent.
   * Audio will be processed by STT and VAD (if configured).
   * @param audio - Raw audio samples
   */
  sendAudio(audio: Float32Array): void;

  /**
   * Stop the agent.
   * Cleans up all adapters and stops processing.
   */
  stop(): void;

  /**
   * Subscribe to agent state changes.
   * @param callback - Function called on state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (state: AgentState) => void): () => void;

  /**
   * Get current agent state snapshot.
   */
  getSnapshot(): AgentState;
}

/**
 * Agent state snapshot.
 */
export interface AgentState {
  /** Current state value */
  value: string | Record<string, unknown>;

  /** Whether the agent is running */
  isRunning: boolean;

  /** Whether the agent is currently speaking */
  isSpeaking: boolean;

  /** Conversation messages */
  messages: Message[];

  /** Current partial transcript */
  partialTranscript: string;

  /** Actor status: 'active', 'done', 'error', or 'stopped' */
  status: "active" | "done" | "error" | "stopped";

  /** Output when agent is done (status === 'done') */
  output: AgentMachineOutput | undefined;
}

/**
 * Helper to check if the agent is in a running state
 */
function isRunningState(value: string | Record<string, unknown>): boolean {
  if (value === "running") return true;
  if (typeof value === "object" && value !== null && "running" in value) return true;
  return false;
}

/**
 * Create a voice agent.
 *
 * @param config - Agent configuration including adapters and options
 * @returns Agent instance
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   adapters: {
 *     stt: mySTTAdapter,
 *     llm: myLLMAdapter,
 *     tts: myTTSAdapter,
 *     audioOutput: myAudioOutputAdapter,
 *   },
 *   onEvent: (event) => {
 *     switch (event.type) {
 *       case 'turn:end':
 *         console.log('User said:', event.transcript);
 *         break;
 *       case 'response:sentence':
 *         console.log('Agent:', event.sentence);
 *         break;
 *     }
 *   },
 * });
 *
 * agent.start();
 * // Send audio from microphone
 * agent.sendAudio(audioChunk);
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  const id = nanoid();
  const resolvedConfig = resolveConfig(config);

  // Create the XState actor
  const actor = createActor(agentMachine, {
    input: { config: resolvedConfig },
  });

  // Subscribe to emitted events using wildcard and forward to onEvent callback
  // This uses XState's native event emission pattern
  actor.on("*", (event) => {
    resolvedConfig.onEvent(event);
  });

  return {
    id,

    start() {
      actor.start();
      actor.send({ type: "agent-start" });
    },

    sendAudio(audio: Float32Array) {
      actor.send({ type: "audio-input-chunk", audio });
    },

    stop() {
      actor.send({ type: "agent-stop" });
      actor.stop();
    },

    subscribe(callback: (state: AgentState) => void) {
      const subscription = actor.subscribe((snapshot) => {
        callback({
          value: snapshot.value,
          isRunning: isRunningState(snapshot.value),
          isSpeaking: snapshot.context.isSpeaking,
          messages: snapshot.context.messages,
          partialTranscript: snapshot.context.partialTranscript,
          status: snapshot.status,
          output: snapshot.output,
        });
      });
      return () => subscription.unsubscribe();
    },

    getSnapshot(): AgentState {
      const snapshot = actor.getSnapshot();
      return {
        value: snapshot.value,
        isRunning: isRunningState(snapshot.value),
        isSpeaking: snapshot.context.isSpeaking,
        messages: snapshot.context.messages,
        partialTranscript: snapshot.context.partialTranscript,
        status: snapshot.status,
        output: snapshot.output,
      };
    },
  };
}
