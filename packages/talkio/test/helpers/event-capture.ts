import { expect } from "vitest";

import type { PublicAgentEvent } from "../../src/types/events";

type RecordedEvent = {
  event: PublicAgentEvent;
  receivedAt: number;
};

type EventType = PublicAgentEvent["type"];

type EventCapture = {
  events: RecordedEvent[];
  onEvent: (event: PublicAgentEvent) => void;
  byType: <T extends EventType>(type: T) => Array<PublicAgentEvent & { type: T }>;
  waitForEvent: <T extends EventType>(type: T) => Promise<PublicAgentEvent & { type: T }>;
  assertInvariants: () => void;
  assertSequence: (types: EventType[]) => void;
};

export function createEventCapture(): EventCapture {
  const events: RecordedEvent[] = [];
  const waiters = new Map<EventType, Array<(event: PublicAgentEvent) => void>>();

  const onEvent = (event: PublicAgentEvent): void => {
    events.push({ event, receivedAt: Date.now() });
    const handlers = waiters.get(event.type);
    if (handlers && handlers.length > 0) {
      const handler = handlers.shift();
      if (handler) {
        handler(event);
      }
    }
  };

  const byType = <T extends EventType>(type: T): Array<PublicAgentEvent & { type: T }> => {
    return events
      .filter(
        (entry): entry is RecordedEvent & { event: PublicAgentEvent & { type: T } } =>
          entry.event.type === type,
      )
      .map((entry) => entry.event);
  };

  const waitForEvent = <T extends EventType>(type: T): Promise<PublicAgentEvent & { type: T }> => {
    const existing = events.find((entry) => entry.event.type === type);
    if (existing) {
      return Promise.resolve(existing.event as PublicAgentEvent & { type: T });
    }
    return new Promise((resolve) => {
      const handlers = waiters.get(type) ?? [];
      handlers.push((event) => resolve(event as PublicAgentEvent & { type: T }));
      waiters.set(type, handlers);
    });
  };

  const assertInvariants = (): void => {
    const types = events.map((entry) => entry.event.type);
    const startedIndex = types.indexOf("agent:started");
    const stoppedIndex = types.indexOf("agent:stopped");

    if (startedIndex >= 0) {
      const turnEventIndex = types.findIndex(
        (type) => type.startsWith("human-turn") || type.startsWith("ai-turn"),
      );
      if (turnEventIndex >= 0) {
        expect(startedIndex).toBeLessThan(turnEventIndex);
      }
    }

    const humanTurnEndIndex = types.indexOf("human-turn:ended");
    const aiTurnStartIndex = types.indexOf("ai-turn:started");
    if (humanTurnEndIndex >= 0 && aiTurnStartIndex >= 0) {
      expect(humanTurnEndIndex).toBeLessThan(aiTurnStartIndex);
    }

    const aiTurnStarts = types
      .map((type, index) => ({ type, index }))
      .filter((entry) => entry.type === "ai-turn:started")
      .map((entry) => entry.index);
    const aiTurnEnds = new Set(
      types
        .map((type, index) => ({ type, index }))
        .filter((entry) => entry.type === "ai-turn:ended" || entry.type === "ai-turn:interrupted")
        .map((entry) => entry.index),
    );

    for (const startIndex of aiTurnStarts) {
      const hasEnd = Array.from(aiTurnEnds).some((endIndex) => endIndex > startIndex);
      expect(hasEnd).toBe(true);
    }

    if (stoppedIndex >= 0) {
      expect(stoppedIndex).toBe(types.length - 1);
    }
  };

  const assertSequence = (expected: EventType[]): void => {
    expect(events.map((entry) => entry.event.type)).toEqual(expected);
  };

  return {
    events,
    onEvent,
    byType,
    waitForEvent,
    assertInvariants,
    assertSequence,
  };
}

export type { EventCapture, EventType, RecordedEvent };
