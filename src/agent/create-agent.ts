/**
 * Create Agent
 *
 * Public function for creating a voice agent.
 */

import { nanoid } from "nanoid";
import { createActor } from "xstate";
import type { AgentMachineOutput, Message } from "../types/common";
import type { AgentConfig } from "../types/config";
import type { PublicAgentEvent } from "../types/events";
import type { AgentMetrics, MetricsTrackingState } from "../types/metrics";
import { agentMachine } from "./machine";

/**
 * Voice agent instance.
 * Provides methods to control the agent and send audio data.
 */
export interface Agent {
  /** Unique identifier for this agent instance */
  readonly id: string;

  /**
   * ReadableStream of audio output chunks.
   * Yields Float32Array chunks as they are produced by TTS.
   * Use this to handle audio playback in your application.
   *
   * @example
   * ```typescript
   * const reader = agent.audioStream.getReader();
   * while (true) {
   *   const { done, value } = await reader.read();
   *   if (done) break;
   *   playAudio(value); // Float32Array chunk
   * }
   * ```
   */
  readonly audioStream: ReadableStream<Float32Array>;

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

  /** Cumulative metrics for the session */
  metrics: AgentMetrics;
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
 * Check if an event is internal (prefixed with "_")
 */
function isInternalEvent(event: { type: string }): boolean {
  return event.type.startsWith("_");
}

/**
 * Compute aggregate AgentMetrics from the internal tracking state.
 */
function computeAgentMetrics(metricsState: MetricsTrackingState): AgentMetrics {
  const m = metricsState;
  const now = Date.now();

  return {
    session: {
      startedAt: m.sessionStartedAt ?? 0,
      duration: m.sessionStartedAt ? now - m.sessionStartedAt : 0,
    },
    turns: {
      total: m.totalTurns,
      completed: m.completedTurns,
      interrupted: m.interruptedTurns,
      abandoned: m.abandonedTurns,
    },
    latency: {
      averageTimeToFirstToken:
        m.completedTurnsForAverage > 0 ? m.totalTimeToFirstToken / m.completedTurnsForAverage : 0,
      averageTimeToFirstAudio:
        m.completedTurnsForAverage > 0 ? m.totalTimeToFirstAudio / m.completedTurnsForAverage : 0,
      averageTurnDuration:
        m.completedTurnsForAverage > 0 ? m.totalTurnDuration / m.completedTurnsForAverage : 0,
    },
    content: {
      totalLLMTokens: m.totalLLMTokens,
      totalUserTranscriptChars: m.totalUserTranscriptChars,
      totalResponseChars: m.totalResponseChars,
    },
    audio: {
      totalUserSpeechDuration: m.totalUserSpeechDuration,
      totalAgentSpeakingDuration: m.totalAgentSpeakingDuration,
      totalAudioChunks: m.totalAudioChunks,
      totalAudioSamples: m.totalAudioSamples,
    },
    errors: {
      total: Object.values(m.errorsBySource).reduce((a, b) => a + b, 0),
      bySource: m.errorsBySource,
    },
  };
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
 *       case 'human-turn:ended':
 *         console.log('User said:', event.transcript);
 *         break;
 *       case 'ai-turn:sentence':
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

  // Create audio output stream and capture the controller
  let audioStreamController: ReadableStreamDefaultController<Float32Array> | null = null;
  const audioStream = new ReadableStream<Float32Array>({
    start(controller) {
      audioStreamController = controller;
    },
  });

  // Create the XState actor with the stream controller
  const actor = createActor(agentMachine, {
    input: { config, audioStreamController },
  });

  // Subscribe to emitted events using wildcard and forward to onEvent callback
  // Filter out internal events (prefixed with "_") - only expose public events
  actor.on("*", (event) => {
    if (!isInternalEvent(event)) {
      config.onEvent?.(event as PublicAgentEvent);
    }
  });

  return {
    id,
    audioStream,

    start() {
      actor.start();
      // Use internal event to start the agent
      actor.send({ type: "_agent:start" });
    },

    sendAudio(audio: Float32Array) {
      // Use internal event for audio input
      actor.send({ type: "_audio:input", audio });
    },

    stop() {
      // Use internal event to stop the agent
      actor.send({ type: "_agent:stop" });
      actor.stop();
      // Close the audio stream when agent stops
      try {
        audioStreamController?.close();
      } catch {
        // Stream may already be closed
      }
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
          metrics: computeAgentMetrics(snapshot.context.metrics),
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
        metrics: computeAgentMetrics(snapshot.context.metrics),
      };
    },
  };
}
