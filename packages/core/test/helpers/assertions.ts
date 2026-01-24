/**
 * Custom Test Assertions
 *
 * Helper functions for asserting event sequences and states.
 */

import { expect } from "vitest";

import type { AgentEvent } from "../../src";

/**
 * Assert that events contain a specific sequence in order.
 * The sequence must appear in order, but other events may be interspersed.
 */
export function expectEventSequence(events: AgentEvent[], sequence: AgentEvent["type"][]): void {
  let sequenceIndex = 0;
  for (const event of events) {
    if (event.type === sequence[sequenceIndex]) {
      sequenceIndex++;
      if (sequenceIndex === sequence.length) {
        return; // Found complete sequence
      }
    }
  }
  expect.fail(
    `Expected event sequence ${JSON.stringify(sequence)} but only found ${sequenceIndex} events in sequence. ` +
      `Actual events: ${events.map((e) => e.type).join(", ")}`,
  );
}

/**
 * Assert that no internal events (prefixed with "_") are present.
 */
export function expectNoInternalEvents(events: AgentEvent[]): void {
  const internalEvents = events.filter((e) => e.type.startsWith("_"));
  expect(internalEvents).toHaveLength(0);
}

/**
 * Assert that a specific event type exists in the events array.
 */
export function expectEventExists(events: AgentEvent[], type: AgentEvent["type"]): void {
  const found = events.some((e) => e.type === type);
  expect(found, `Expected event "${type}" to exist`).toBe(true);
}

/**
 * Assert that a specific event type does NOT exist in the events array.
 */
export function expectEventNotExists(events: AgentEvent[], type: AgentEvent["type"]): void {
  const found = events.some((e) => e.type === type);
  expect(found, `Expected event "${type}" to NOT exist`).toBe(false);
}

/**
 * Find an event by type with type narrowing.
 * Returns undefined if not found.
 */
export function findEvent<T extends AgentEvent["type"]>(
  events: AgentEvent[],
  type: T,
): Extract<AgentEvent, { type: T }> | undefined {
  return events.find((e) => e.type === type) as Extract<AgentEvent, { type: T }> | undefined;
}

/**
 * Find all events of a specific type.
 */
export function findEvents<T extends AgentEvent["type"]>(
  events: AgentEvent[],
  type: T,
): Extract<AgentEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<AgentEvent, { type: T }>[];
}

/**
 * Get the count of events of a specific type.
 */
export function countEvents(events: AgentEvent[], type: AgentEvent["type"]): number {
  return events.filter((e) => e.type === type).length;
}

/**
 * Assert agent snapshot has expected values.
 */
export function expectSnapshotState(
  snapshot: {
    value: string;
    isRunning: boolean;
    isSpeaking: boolean;
    messages: unknown[];
    partialTranscript: string;
  },
  expected: Partial<{
    value: string;
    isRunning: boolean;
    isSpeaking: boolean;
    messageCount: number;
    partialTranscript: string;
  }>,
): void {
  if (expected.value !== undefined) {
    expect(snapshot.value).toBe(expected.value);
  }
  if (expected.isRunning !== undefined) {
    expect(snapshot.isRunning).toBe(expected.isRunning);
  }
  if (expected.isSpeaking !== undefined) {
    expect(snapshot.isSpeaking).toBe(expected.isSpeaking);
  }
  if (expected.messageCount !== undefined) {
    expect(snapshot.messages).toHaveLength(expected.messageCount);
  }
  if (expected.partialTranscript !== undefined) {
    expect(snapshot.partialTranscript).toBe(expected.partialTranscript);
  }
}
