# voice-ai

A TypeScript package for building voice AI agents with full orchestration. Provides turn management, barge-in detection, and seamless coordination between speech-to-text (STT), language models (LLM), and text-to-speech (TTS) components.

## Overview

`voice-ai` is an orchestration layer that handles the complexities of real-time voice interactions. It uses [XState](https://stately.ai/docs/xstate) and the actor model internally to manage concurrency, state transitions, and event coordination—all while providing a simple, provider-agnostic API.

### Key Features

- **Full Auto-Orchestration**: Automatically chains STT → LLM → TTS → Audio Output
- **Barge-in Detection**: Handles user interruptions gracefully
- **Provider Agnostic**: Works with any STT, LLM, or TTS provider
- **Type-Safe**: Full TypeScript support with discriminated unions
- **Event-Driven**: Simple `onEvent` callback for observability
- **Two-Layer Events**: Clean semantic events for users, internal events hidden
- **Filler Support**: Adapters can trigger fillers via `ctx.say()` for latency hiding
- **Multimodal Messages**: Support for text, audio, images, files, and tool calls

## Installation

```bash
bun add voice-ai
# or
npm install voice-ai
# or
pnpm add voice-ai
```

**Dependencies**: This package only requires `xstate` and `nanoid`. You install your own provider SDKs separately.

## Quick Start

```typescript
import { createAgent } from "voice-ai";
import { createDeepgramSTT } from "./adapters/deepgram";
import { createOpenAILLM } from "./adapters/openai";
import { createElevenLabsTTS } from "./adapters/elevenlabs";

const agent = createAgent({
  stt: createDeepgramSTT(process.env.DEEPGRAM_KEY!),
  llm: createOpenAILLM({ systemPrompt: "You are a helpful assistant." }),
  tts: createElevenLabsTTS(process.env.ELEVEN_KEY!),
  onEvent: (event) => {
    switch (event.type) {
      case "human-turn:ended":
        console.log("User said:", event.transcript);
        break;
      case "ai-turn:sentence":
        console.log("Agent:", event.sentence);
        break;
      case "ai-turn:interrupted":
        console.log("User interrupted!");
        break;
    }
  },
});

// Start the agent
agent.start();

// Send audio from microphone
agent.sendAudio(audioChunk);

// Stop when done
agent.stop();
```

## Architecture

### Design Philosophy

1. **Orchestration Only**: The package focuses exclusively on coordinating components, not implementing them
2. **XState Under the Hood**: Uses XState's actor model internally (users never see it)
3. **Adapter Pattern**: Users provide simple adapter objects that conform to interfaces
4. **Provider Agnostic**: Works with any STT/LLM/TTS provider
5. **Two-Layer Events**: Internal events are filtered out—users only see clean semantic events

### Flow

```
User Audio → STT → Turn End → LLM → Sentences → TTS → Audio Output
                ↓
            (Barge-in detection)
```

The machine automatically:

1. Routes audio to STT adapter
2. Detects when user's turn ends
3. Spawns LLM actor with conversation history
4. Streams sentences to TTS as they arrive
5. Plays audio through output adapter
6. Handles barge-in by cancelling LLM/TTS

## Adapter Interfaces

Users implement adapters that conform to these interfaces. Each adapter receives a `ctx` object with:

- **Emit methods**: Report events back to orchestrator
- **Control methods**: Trigger orchestration features (like fillers)

### STT Adapter (Required)

```typescript
interface STTAdapter {
  start(ctx: STTContext): void;
  stop(): void;
  sendAudio(audio: Float32Array): void;
}

interface STTContext {
  transcript(text: string, isFinal: boolean): void;
  speechStart(): void; // Optional: fallback VAD
  speechEnd(): void; // Optional: fallback VAD
  error(error: Error): void;
  signal: AbortSignal;
}
```

### LLM Adapter (Required)

Cancellation is handled via `ctx.signal` (AbortSignal).

```typescript
interface LLMAdapter {
  generate(messages: Message[], ctx: LLMContext): void;
}

interface LLMContext {
  token(token: string): void;
  sentence(sentence: string, index: number): void;
  complete(fullText: string): void;
  error(error: Error): void;
  say(text: string): void; // Trigger filler
  interrupt(): void; // Interrupt audio streaming
  isSpeaking(): boolean;
  signal: AbortSignal; // Listen for cancellation
}
```

### TTS Adapter (Required)

Cancellation is handled via `ctx.signal` (AbortSignal).

```typescript
interface TTSAdapter {
  synthesize(text: string, ctx: TTSContext): void;
}

interface TTSContext {
  audioChunk(audio: Float32Array): void;
  complete(): void;
  error(error: Error): void;
  signal: AbortSignal; // Listen for cancellation
}
```

### VAD Adapter (Optional)

If not provided, STT's built-in VAD is used as fallback.

```typescript
interface VADAdapter {
  start(ctx: VADContext): void;
  stop(): void;
  processAudio(audio: Float32Array): void;
}

interface VADContext {
  speechStart(): void;
  speechEnd(duration: number): void;
  speechProbability(probability: number): void; // For visualization
  signal: AbortSignal;
}
```

### Turn Detector Adapter (Optional)

If not provided, STT's final transcript marks turn end.

```typescript
interface TurnDetectorAdapter {
  start(ctx: TurnDetectorContext): void;
  stop(): void;
  onSpeechEnd(duration: number): void;
  onTranscript(text: string, isFinal: boolean): void;
}

interface TurnDetectorContext {
  turnEnd(transcript: string): void;
  turnAbandoned(reason: string): void;
  signal: AbortSignal;
}
```

## Creating Custom Providers

Use the factory functions to create custom providers with less boilerplate:

### `createCustomSTTProvider`

```typescript
import { createCustomSTTProvider } from "voice-ai";

const stt = createCustomSTTProvider({
  name: "MySTT",
  version: "1.0.0", // optional, defaults to "1.0.0"
  start: (ctx) => {
    // Initialize STT connection
    // Use ctx.transcript(), ctx.speechStart(), ctx.speechEnd(), ctx.error()
  },
  stop: () => {
    // Clean up resources
  },
  sendAudio: (audio) => {
    // Send audio to STT service
  },
});
```

### `createCustomLLMProvider`

```typescript
import { createCustomLLMProvider } from "voice-ai";

const llm = createCustomLLMProvider({
  name: "MyLLM",
  generate: async (messages, ctx) => {
    // Stream tokens using ctx.token()
    // Report sentences using ctx.sentence()
    // Complete with ctx.complete()
    // Use ctx.say() for filler phrases
  },
});
```

### `createCustomTTSProvider`

```typescript
import { createCustomTTSProvider } from "voice-ai";

const tts = createCustomTTSProvider({
  name: "MyTTS",
  synthesize: async (text, ctx) => {
    // Stream audio chunks using ctx.audioChunk()
    // Complete with ctx.complete()
    // Handle errors with ctx.error()
  },
});
```

### `createCustomVADProvider`

```typescript
import { createCustomVADProvider } from "voice-ai";

const vad = createCustomVADProvider({
  name: "MyVAD",
  start: (ctx) => {
    // Initialize VAD
    // Use ctx.speechStart(), ctx.speechEnd(), ctx.speechProbability()
  },
  stop: () => {
    // Clean up resources
  },
  processAudio: (audio) => {
    // Analyze audio for speech activity
  },
});
```

### `createCustomTurnDetectorProvider`

```typescript
import { createCustomTurnDetectorProvider } from "voice-ai";

const turnDetector = createCustomTurnDetectorProvider({
  name: "MyTurnDetector",
  start: (ctx) => {
    // Initialize turn detection
    // Use ctx.turnEnd(), ctx.turnAbandoned()
  },
  stop: () => {
    // Clean up resources
  },
  onSpeechEnd: (duration) => {
    // Handle speech end event
  },
  onTranscript: (text, isFinal) => {
    // Handle transcript updates
  },
});
```

## API Reference

### `createAgent(config)`

Creates a voice agent instance.

**Parameters:**

- `config.stt` - Required STT provider
- `config.llm` - Required LLM provider
- `config.tts` - Required TTS provider
- `config.vad` - Optional VAD provider (falls back to STT VAD)
- `config.turnDetector` - Optional turn detector provider
- `config.bargeIn` - Barge-in configuration
  - `enabled?: boolean` (default: `true`)
  - `minDurationMs?: number` (default: `200`)
- `config.onEvent?: (event: AgentEvent) => void` - Event handler callback

**Returns:** `Agent` instance

### `Agent` Interface

```typescript
interface Agent {
  readonly id: string;
  readonly audioStream: ReadableStream<Float32Array>;
  start(): void;
  sendAudio(audio: Float32Array): void;
  stop(): void;
  subscribe(callback: (state: AgentState) => void): () => void;
  getSnapshot(): AgentState;
}
```

### `AgentState` Interface

```typescript
interface AgentState {
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
```

## Events

The event system uses a **two-layer architecture**:

- **Public events**: Semantic, user-friendly events exposed via `onEvent` callback
- **Internal events**: Machine-only events (prefixed with `_`) that are automatically filtered out

### Events

All public events use colon-separated naming with discriminated unions for type-safe handling:

```typescript
type AgentEvent =
  // Agent lifecycle
  | { type: "agent:started" }
  | { type: "agent:stopped" }
  | { type: "agent:error"; error: Error; source: "stt" | "llm" | "tts" | "vad" }

  // Human turn events
  | { type: "human-turn:started" }
  | { type: "human-turn:transcript"; text: string; isFinal: boolean }
  | { type: "human-turn:ended"; transcript: string }
  | { type: "human-turn:abandoned"; reason: string }

  // AI turn events
  | { type: "ai-turn:started" }
  | { type: "ai-turn:token"; token: string }
  | { type: "ai-turn:sentence"; sentence: string; index: number }
  | { type: "ai-turn:audio"; audio: Float32Array }
  | { type: "ai-turn:ended"; text: string; wasSpoken: boolean }
  | { type: "ai-turn:interrupted"; partialText: string }

  // Debug events
  | { type: "vad:probability"; value: number };
```

### Event Categories

| Category            | Events                                                                                                          | Description              |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Agent Lifecycle** | `agent:started`, `agent:stopped`, `agent:error`                                                                 | Agent state changes      |
| **Human Turn**      | `human-turn:started`, `human-turn:transcript`, `human-turn:ended`, `human-turn:abandoned`                       | User speech lifecycle    |
| **AI Turn**         | `ai-turn:started`, `ai-turn:token`, `ai-turn:sentence`, `ai-turn:audio`, `ai-turn:ended`, `ai-turn:interrupted` | Agent response lifecycle |
| **Debug**           | `vad:probability`                                                                                               | Optional observability   |

### Key Differences from Raw Provider Events

The public events abstract away implementation details:

| What You See            | What's Hidden                              |
| ----------------------- | ------------------------------------------ |
| `human-turn:started`    | `_stt:speech-start` or `_vad:speech-start` |
| `human-turn:transcript` | `_stt:transcript`                          |
| `human-turn:ended`      | `_turn:end` or `_stt:transcript` (final)   |
| `ai-turn:audio`         | `_tts:chunk` (no duplicate events)         |
| `ai-turn:ended`         | `_tts:complete` or `_llm:complete`         |
| `agent:error`           | `_stt:error`, `_llm:error`, `_tts:error`   |

## Message Types

The package supports rich multimodal messages:

```typescript
type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// Content can be simple text or an array of parts
type MessageContent = string | ContentPart[];

// Available content part types
type ContentPart =
  | TextPart // { type: 'text'; text: string }
  | AudioPart // { type: 'audio'; data: string; mediaType: string; transcript?: string }
  | ImagePart // { type: 'image'; data: string; mediaType: string }
  | FilePart // { type: 'file'; data: string; mediaType: string; filename?: string }
  | ToolCallPart // { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | ToolResultPart; // { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
```

## Examples

### Example: Deepgram STT Adapter

```typescript
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { STTAdapter, STTContext } from "voice-ai";

export function createDeepgramSTT(apiKey: string): STTAdapter {
  let connection: any = null;

  return {
    metadata: { name: "Deepgram", version: "1.0.0", type: "stt" },

    start(ctx: STTContext) {
      const client = createClient(apiKey);
      connection = client.listen.live({ model: "nova-2" });

      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const text = data.channel.alternatives[0].transcript;
        ctx.transcript(text, data.is_final);
      });

      connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
        ctx.speechStart();
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
        ctx.error(err);
      });
    },

    stop() {
      connection?.close();
    },

    sendAudio(audio: Float32Array) {
      connection?.send(audio.buffer);
    },
  };
}
```

### Example: OpenAI LLM Adapter with Filler Support

```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { LLMAdapter, LLMContext, Message } from "voice-ai";

export function createOpenAILLM(systemPrompt: string): LLMAdapter {
  return {
    metadata: { name: "OpenAI", version: "1.0.0", type: "llm" },

    async generate(messages: Message[], ctx: LLMContext) {
      const fullMessages = [{ role: "system" as const, content: systemPrompt }, ...messages];

      let firstToken = false;

      // Trigger filler after 300ms of no tokens
      const fillerTimeout = setTimeout(() => {
        if (!firstToken) {
          ctx.say("Let me think...");
        }
      }, 300);

      try {
        const result = streamText({
          model: openai("gpt-4o"),
          messages: fullMessages,
          abortSignal: ctx.signal, // Use ctx.signal for cancellation
        });

        let buffer = "";
        let sentenceIndex = 0;

        for await (const chunk of result.textStream) {
          if (!firstToken) {
            firstToken = true;
            clearTimeout(fillerTimeout);
            ctx.interrupt(); // Stop filler if it started
          }

          ctx.token(chunk);
          buffer += chunk;

          // Sentence boundary detection
          const match = buffer.match(/^(.+?[.!?])\s+/);
          if (match) {
            ctx.sentence(match[1], sentenceIndex++);
            buffer = buffer.slice(match[0].length);
          }
        }

        if (buffer.trim()) {
          ctx.sentence(buffer.trim(), sentenceIndex);
        }

        ctx.complete((await result).text);
      } catch (error: any) {
        if (error.name !== "AbortError") {
          ctx.error(error);
        }
      } finally {
        clearTimeout(fillerTimeout);
      }
    },
  };
}
```

### Example: ElevenLabs TTS Adapter

```typescript
import { ElevenLabsClient } from "elevenlabs";
import type { TTSAdapter, TTSContext } from "voice-ai";

export function createElevenLabsTTS(apiKey: string): TTSAdapter {
  const client = new ElevenLabsClient({ apiKey });

  return {
    metadata: { name: "ElevenLabs", version: "1.0.0", type: "tts" },

    async synthesize(text: string, ctx: TTSContext) {
      try {
        const audioStream = await client.textToSpeech.convertAsStream("voice-id", {
          text,
          model_id: "eleven_turbo_v2_5",
        });

        for await (const chunk of audioStream) {
          // Check if cancelled
          if (ctx.signal.aborted) break;

          // Convert chunk to Float32Array
          const audioBuffer = await new Response(chunk).arrayBuffer();
          const audioData = new Float32Array(audioBuffer.byteLength / 2);
          // ... convert to Float32Array ...
          ctx.audioChunk(audioData);
        }

        if (!ctx.signal.aborted) {
          ctx.complete();
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          ctx.error(error as Error);
        }
      }
    },
  };
}
```

## VAD and Turn Detection

Both VAD and turn detection have fallback mechanisms:

| Feature            | If Adapter Provided        | Fallback                                  |
| ------------------ | -------------------------- | ----------------------------------------- |
| **VAD**            | Uses VAD adapter           | STT's built-in VAD events                 |
| **Turn Detection** | Uses turn detector adapter | STT's `transcript(text, true)` = turn end |

This means you can get a working voice agent with just the three required adapters, but can add specialized VAD (e.g., Silero for faster barge-in) or semantic turn detection when needed.

## Barge-in Detection

Barge-in is detected when:

1. Agent is currently speaking (`isSpeaking` is true)
2. VAD detects speech start (from VAD adapter or STT fallback)
3. Speech duration exceeds `minDurationMs` (to filter noise)

When barge-in occurs:

- `ai-turn:interrupted` event is emitted with partial text
- AbortSignal is triggered to cancel LLM and TTS
- Audio streaming is stopped
- Agent returns to listening state

## Filler Phrases

Adapters can use `ctx.say()` to trigger filler phrases during latency:

```typescript
// In your LLM adapter
const timeout = setTimeout(() => {
  if (!firstToken) {
    ctx.say("Let me check that for you...");
  }
}, 300);

// When real response arrives
firstToken = true;
clearTimeout(timeout);
ctx.interrupt(); // Stop filler
```

Note: Filler events (`_filler:say`, `_filler:interrupt`) are internal and not exposed to users.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format

# Build
bun run build
```

## Testing

The test suite includes realistic conversation flow tests that verify:

- Complete turn orchestration (STT → LLM → TTS → Audio)
- Filler phrase support
- Barge-in handling
- Multi-turn conversations
- Error handling
- Internal event filtering

See `test/index.test.ts` for examples.

## Why the Actor Model?

The actor model (via XState) elegantly solves voice AI challenges:

| Challenge             | Traditional Approach          | Actor Model Solution                   |
| --------------------- | ----------------------------- | -------------------------------------- |
| Concurrent streams    | Shared state, race conditions | Each actor owns its state              |
| Barge-in cancellation | Manual AbortController chains | `stopChild()` propagates automatically |
| Complex state logic   | Nested if/else, flags         | Visual state machine                   |
| Testing               | Mock everything               | Test actors in isolation               |
| Debugging             | Console.log                   | XState Inspector                       |

## License

MIT
