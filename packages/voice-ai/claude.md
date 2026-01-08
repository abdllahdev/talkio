# voice-ai Package - Claude Development Guide

## Project Overview

`voice-ai` is a TypeScript orchestration library for building real-time voice AI agents. It handles the complex coordination between Speech-to-Text (STT), Language Models (LLM), Text-to-Speech (TTS), and audio playback components using the actor model via XState.

**Key Insight**: This is NOT a collection of provider implementations. It's pure orchestration—users bring their own providers via factory functions.

## Core Concepts

### 1. Orchestration-Only Design

- The package provides zero STT/LLM/TTS implementations
- Users use provider packages (e.g., `@voice-ai/provider-deepgram`) or implement their own
- The library handles all state management, concurrency, and coordination

### 2. Actor Model Architecture

- Built on XState v5 for robust state management
- Each component (STT, LLM, TTS, etc.) runs as an isolated actor
- Automatic cleanup and cancellation propagation
- No shared state—communication through events only

### 3. Provider Pattern (Vercel AI SDK Style)

- Works with any STT provider (Deepgram, AssemblyAI, etc.)
- Works with any LLM provider (OpenAI, Anthropic, etc.)
- Works with any TTS provider (ElevenLabs, Play.ht, etc.)
- Providers are created via factory functions: `createDeepgramSTT({ apiKey })`
- Each provider includes metadata (`name`, `version`, `type`) for debugging

## Project Structure

```
src/
├── types/
│   ├── common.ts      # Shared types (Message, MessageContent, ContentPart)
│   ├── events.ts      # All event types (discriminated union)
│   └── config.ts      # Agent configuration types
├── agent/
│   ├── machine.ts     # Main XState machine definition
│   ├── context.ts     # Machine context and types
│   ├── create-agent.ts # Public API factory function
│   └── actors/
│       ├── stt.ts           # STT actor logic
│       ├── vad.ts           # VAD actor logic
│       ├── llm.ts           # LLM actor logic
│       ├── tts.ts           # TTS actor logic
│       ├── turn-detector.ts # Turn detection actor logic
│       ├── streamer.ts      # Audio streaming coordinator
│       └── index.ts         # Actor exports
├── providers/
│   └── types.ts       # Provider interface definitions
└── index.ts           # Public API exports
```

## Key Files and Their Roles

### `src/types/events.ts`

Defines all events using a **two-layer architecture**:

**Public Events** (exposed to users via `onEvent`):

- `agent:*` - Agent lifecycle (`agent:started`, `agent:stopped`, `agent:error`)
- `human-turn:*` - User turn lifecycle (`human-turn:started`, `human-turn:transcript`, `human-turn:ended`)
- `ai-turn:*` - Agent turn lifecycle (`ai-turn:started`, `ai-turn:token`, `ai-turn:sentence`, `ai-turn:audio`, `ai-turn:ended`, `ai-turn:interrupted`)
- `vad:probability` - Debug event for VAD visualization

**Internal Events** (machine use only, prefixed with `_`):

- `_stt:*` - STT actor events (`_stt:transcript`, `_stt:speech-start`, `_stt:speech-end`, `_stt:error`)
- `_vad:*` - VAD actor events (`_vad:speech-start`, `_vad:speech-end`, `_vad:probability`)
- `_turn:*` - Turn detector events (`_turn:end`, `_turn:abandoned`)
- `_llm:*` - LLM actor events (`_llm:token`, `_llm:sentence`, `_llm:complete`, `_llm:error`)
- `_tts:*` - TTS actor events (`_tts:chunk`, `_tts:complete`, `_tts:error`)
- `_filler:*` - Filler control events (`_filler:say`, `_filler:interrupt`)
- `_audio:*` - Audio events (`_audio:input`, `_audio:output-start`, `_audio:output-chunk`, `_audio:output-end`)
- `_agent:*` - Agent control events (`_agent:start`, `_agent:stop`)

**Key types:**

- `PublicAgentEvent` - Union of all public events
- `InternalAgentEvent` - Union of all internal events (prefixed with `_`)
- `MachineEvent` - Union of both (used internally in machine.ts)
- `AgentEvent` - Alias for `PublicAgentEvent` (exported to users)

**Important**: All events use discriminated unions for type safety. Never use string literals.

### `src/types/common.ts`

Message types and content parts:

- `Message` - Union of SystemMessage | UserMessage | AssistantMessage | ToolMessage
- `MessageContent` - Can be simple string or ContentPart[]
- `ContentPart` - Text, audio, image, file, tool calls, tool results

### `src/agent/machine.ts`

The XState state machine that orchestrates everything. States include:

- `idle` - Initial state
- `running` - Active listening and processing
- `stopped` - Terminated state

Inside `running`, parallel regions handle:

- Audio input processing
- Turn management (human vs AI turns)
- Barge-in detection

### `src/agent/create-agent.ts`

Public API factory. Returns an `Agent` interface:

```typescript
interface Agent {
  readonly id: string;
  start(): void;
  sendAudio(audio: Float32Array): void;
  stop(): void;
  subscribe(callback: (state: AgentState) => void): () => void;
  getSnapshot(): AgentState;
}
```

### `src/providers/types.ts`

Defines all provider interfaces:

- `STTProvider` (required) - Speech-to-Text
- `LLMProvider` (required) - Language Model
- `TTSProvider` (required) - Text-to-Speech
- `AudioStreamerProvider` (required) - Audio Output
- `VADProvider` (optional, falls back to STT's VAD)
- `TurnDetectorProvider` (optional, falls back to STT final transcript)

Each provider extends `BaseProvider` which includes metadata:

```typescript
interface ProviderMetadata {
  name: string; // e.g., "Deepgram"
  version: string; // e.g., "1.0.0"
  type: ProviderType;
}
```

**Critical**: Each provider receives a context object with methods to emit events back to the orchestrator.

### `src/agent/actors/*.ts`

Individual actor implementations that wrap providers:

- Call provider methods
- Convert provider events to machine events
- Handle cleanup on abort signals
- Manage actor lifecycle

## How It Works

### Conversation Flow

1. **User speaks** → Audio chunks sent via `agent.sendAudio()`
2. **STT processes** → Emits partial/final transcripts
3. **Turn detection** → Determines when user finished speaking
4. **LLM generates** → Receives message history, streams tokens
5. **Sentence detection** → LLM provider breaks response into sentences
6. **TTS synthesis** → Each sentence converted to audio chunks
7. **Audio playback** → Chunks played through output provider

### Barge-in Handling

When user interrupts the agent:

1. VAD detects speech start while agent is speaking
2. If speech duration > `minDurationMs` (default 200ms)
3. Machine emits `ai-turn:interrupted` event
4. Cancels LLM actor (via `stopChild()`)
5. Cancels TTS actor
6. Stops audio output
7. Returns to listening state

All cancellation is automatic through actor model.

### Filler Phrase System

LLM providers can use `ctx.say()` to trigger filler phrases:

```typescript
// In LLM provider
const timeout = setTimeout(() => {
  if (!firstToken) {
    ctx.say("Let me think about that...");
  }
}, 300);

// When first token arrives
ctx.interrupt(); // Stops filler playback
```

The machine handles this by temporarily spawning TTS for the filler, then interrupting when real response arrives.

## Development Guidelines

### Adding Features

1. **New Event Types**: Add to `src/types/events.ts` discriminated union
2. **New Provider Type**: Add interface to `src/providers/types.ts`
3. **New Actor**: Create in `src/agent/actors/` following existing patterns
4. **Machine Updates**: Modify `src/agent/machine.ts` state definitions

### Provider Context Pattern

Providers receive a context object with:

- **Emit methods**: Report events back (e.g., `ctx.transcript()`, `ctx.token()`)
- **AbortSignal**: For cancellation (always respect `ctx.signal`)
- **Orchestration methods** (LLM only): `ctx.say()`, `ctx.interrupt()`, `ctx.isSpeaking()`

Example STT context:

```typescript
interface STTContext {
  transcript(text: string, isFinal: boolean): void;
  speechStart(): void;
  speechEnd(): void;
  error(error: Error): void;
  signal: AbortSignal;
}
```

Example LLM context (includes orchestration for filler phrases):

```typescript
interface LLMContext {
  say(text: string): void; // Trigger filler speech
  interrupt(): void; // Stop filler playback
  isSpeaking(): boolean; // Check if agent is speaking
  token(token: string): void;
  sentence(sentence: string, index: number): void;
  complete(fullText: string): void;
  error(error: Error): void;
  signal: AbortSignal;
}
```

### Creating Provider Packages

Provider packages follow the Vercel AI SDK pattern:

```typescript
// @voice-ai/provider-deepgram/src/stt.ts
import type { STTProvider, STTContext } from "voice-ai";

interface DeepgramSTTSettings {
  apiKey?: string;
  model?: string;
  language?: string;
}

export function createDeepgramSTT(settings: DeepgramSTTSettings = {}): STTProvider {
  const { apiKey = process.env.DEEPGRAM_API_KEY, model = "nova-2" } = settings;

  return {
    metadata: {
      name: "Deepgram",
      version: "1.0.0",
      type: "stt",
    },
    start(ctx: STTContext) {
      /* ... */
    },
    stop() {
      /* ... */
    },
    sendAudio(audio: Float32Array) {
      /* ... */
    },
  };
}
```

### Testing Approach

- Unit tests for individual actors
- Integration tests for full conversation flows
- Mock providers for testing without real services
- See `test/index.test.ts` for patterns

### Common Patterns

#### Actor Lifecycle

```typescript
// In actor file (e.g., src/agent/actors/stt.ts)
fromCallback(({ sendBack, input }) => {
  const provider = input.config.stt;

  provider.start({
    transcript: (text, isFinal) => sendBack({ type: "_stt:transcript", text, isFinal }),
    error: (error) => sendBack({ type: "_stt:error", error }),
    signal: input.abortSignal,
  });

  return () => {
    provider.stop(); // Cleanup
  };
});
```

**Note**: Actors emit internal events (prefixed with `_`). The machine translates these to public events.

#### Discriminated Union Event Handling

```typescript
// Always use type narrowing (users only see public events)
onEvent: (event) => {
  switch (event.type) {
    case "human-turn:ended":
      console.log(event.transcript); // TypeScript knows this exists
      break;
    case "ai-turn:token":
      console.log(event.token); // TypeScript knows this exists
      break;
    case "ai-turn:ended":
      console.log(event.text, event.wasSpoken); // TypeScript knows these exist
      break;
  }
};
```

## Important Conventions

### Naming

- **Public Events**: `category:action` format (e.g., `ai-turn:ended`, `human-turn:started`)
- **Internal Events**: `_category:action` format with underscore prefix (e.g., `_stt:transcript`, `_llm:complete`)
- **Types**: `PascalCase` (e.g., `AgentConfig`, `STTProvider`)
- **Variables**: `camelCase` (e.g., `partialTranscript`, `isSpeaking`)

### Audio Format

All audio is `Float32Array`:

- Input: `agent.sendAudio(audio: Float32Array)`
- STT provider: `sendAudio(audio: Float32Array)`
- TTS context: `audioChunk(audio: Float32Array)`
- Audio output: `stream(audio: Float32Array)`

### Message Immutability

Never mutate message arrays—always create new arrays:

```typescript
// Good
messages: [...context.messages, newMessage];

// Bad
messages: context.messages.push(newMessage);
```

### Error Handling

- Providers report errors via context: `ctx.error(error)`
- Actors emit internal error events (e.g., `_stt:error`, `_llm:error`)
- Machine translates to public `agent:error` event with `source` field
- AbortErrors are silently ignored (expected during cancellation)

## Dependencies

### Runtime

- `xstate@^5.25.0` - State machine and actor model
- `nanoid@^5.1.6` - ID generation

### Development

- TypeScript for type safety
- Vitest for testing
- tsdown for building (dual ESM/CJS)
- oxlint for linting
- oxfmt for formatting

## Building and Publishing

```bash
bun run build      # Creates dist/ with ESM and CJS
bun run typecheck  # Verify TypeScript
bun run test       # Run test suite
bun run lint       # Check code quality
```

Build output:

- `dist/index.js` - ESM bundle
- `dist/index.cjs` - CommonJS bundle
- `dist/index.d.ts` - TypeScript types (ESM)
- `dist/index.d.cts` - TypeScript types (CJS)

## Common Tasks

### Adding a New Event Type

**For internal events (actor → machine):**

1. Add to `InternalAgentEvent` union in `src/types/events.ts` (use `_` prefix)
2. Update actor to emit the event via `sendBack()`
3. Add handler in `machine.ts` to process the event
4. Add test coverage

**For public events (machine → user):**

1. Add to `PublicAgentEvent` union in `src/types/events.ts`
2. Add emit action in `machine.ts` (e.g., `emitMyNewEvent`)
3. Trigger emit action from appropriate internal event handler
4. Export type from `src/index.ts`
5. Document in README.md events section
6. Add test coverage

### Adding a New Provider Type

1. Define interface in `src/providers/types.ts`
2. Create actor in `src/agent/actors/`
3. Integrate into machine in `src/agent/machine.ts`
4. Update `AgentConfig` in `src/types/config.ts`
5. Document in README.md
6. Add example implementation

### Debugging State Machine

- Use XState Inspector for visualization
- Add logging in `onEvent` callback
- Check `agent.getSnapshot()` for current state
- Use `subscribe()` to watch state changes

## Architecture Decisions

### Why XState?

- Prevents race conditions in concurrent streams
- Automatic cleanup and cancellation
- Visual state machine diagrams
- Testing in isolation
- Built-in debugging tools

### Why Provider Pattern?

- Users can swap providers without changing orchestration
- Testing with mocks is trivial
- No vendor lock-in
- Smaller bundle size (users only include what they need)
- Separate packages for each provider (e.g., `@voice-ai/provider-deepgram`)

### Why Actor Model?

- Each component owns its state (no shared mutable state)
- Cancellation propagates automatically
- Easy to reason about concurrency
- Natural fit for streaming APIs

## Performance Considerations

- Audio chunks should be processed immediately (don't buffer unnecessarily)
- Sentence detection should emit ASAP for low latency
- TTS can start before LLM completes (streaming)
- VAD should be lightweight (runs on every audio chunk)
- AbortSignals ensure no memory leaks from cancelled operations

## Security Notes

- Never log full messages (may contain sensitive user data)
- Providers should validate API keys in their implementations
- AbortSignal cleanup prevents resource exhaustion
- No sensitive data in event emissions to user callbacks

## Coding Style Guidelines

### TypeScript

- Use `type` for type aliases, `interface` for object shapes that may be extended
- Prefer discriminated unions over union of strings for events
- Use `readonly` for immutable properties
- Avoid `any` - use `unknown` with type guards instead

### Event Architecture

- Internal events start with `_` (underscore) and use `category:action` format
- Public events use `category:action` format without underscore
- Machine handles translation between internal → public events
- Users never see internal events (filtered in `create-agent.ts`)

### Machine Patterns

- Use `emit()` for public events, never `sendBack()` for user-facing events
- Track state with context fields (e.g., `aiTurnHadAudio`, `lastLLMResponse`)
- Use guards for conditional transitions
- Clean up actors via `stopChild()` before stopping

### Actor Patterns

- Always respect `ctx.signal` (AbortSignal) for cancellation
- Return cleanup function from `fromCallback`
- Emit only internal events (`_` prefixed)
- Handle errors gracefully - emit error event, don't throw

### Testing

- Mock providers should emit events in realistic order
- Test both success and error paths
- Verify internal events are filtered from `onEvent`
- Use `vi.waitFor()` for async event assertions

### Formatting

- Use `oxfmt` for consistent formatting
- 2-space indentation
- Double quotes for strings
- Semicolons required
- Trailing commas in multi-line structures
