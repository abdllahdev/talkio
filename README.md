# voice-ai

A TypeScript orchestration library for building real-time voice AI agents. Handles the complex coordination between Speech-to-Text (STT), Language Models (LLM), Text-to-Speech (TTS), and audio components using XState's actor model.

## Key Features

- **Pure Orchestration** - Bring your own providers; zero vendor lock-in
- **Actor Model Architecture** - Built on XState v5 for robust state management and automatic cleanup
- **Barge-in Detection** - Intelligent interruption handling when users speak over the agent
- **Turn Management** - Automatic detection of when users finish speaking
- **Streaming Pipeline** - Low-latency sentence-level streaming from LLM to TTS
- **Filler Phrases** - Support for acknowledgments while waiting for LLM responses
- **Type-Safe Events** - Full TypeScript support with discriminated unions

## Installation

```bash
npm install voice-ai
# or
bun add voice-ai
```

## Quick Start

```typescript
import { createAgent } from "voice-ai";

// Create an agent with your providers
const agent = createAgent({
  stt: createDeepgramSTT({ apiKey: process.env.DEEPGRAM_API_KEY }),
  llm: createOpenAILLM({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o",
    systemPrompt: "You are a helpful voice assistant.",
  }),
  tts: createElevenLabsTTS({
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: "rachel",
  }),
  onEvent: (event) => {
    switch (event.type) {
      case "human-turn:ended":
        console.log("User said:", event.transcript);
        break;
      case "ai-turn:audio":
        playAudio(event.audio);
        break;
    }
  },
});

// Start the agent
agent.start();

// Send audio from microphone
microphone.on("data", (audio: Float32Array) => {
  agent.sendAudio(audio);
});

// Stop when done
agent.stop();
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Voice AI Agent                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │   STT   │→ │   LLM   │→ │   TTS   │→ │  Audio Output   │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │
│       ↑            ↑            ↑                           │
│  ┌─────────┐  ┌─────────────────────┐                       │
│  │   VAD   │  │   Turn Detector     │  (optional)           │
│  └─────────┘  └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

Each component runs as an isolated XState actor with:

- No shared state - communication through events only
- Automatic cleanup and cancellation propagation
- AbortSignal support for graceful termination

## Provider Pattern

Providers follow a factory function pattern similar to Vercel AI SDK:

```typescript
// Provider packages export factory functions
import { createDeepgramSTT } from "@voice-ai/provider-deepgram";

const stt = createDeepgramSTT({
  apiKey: process.env.DEEPGRAM_API_KEY,
  model: "nova-2",
  language: "en-US",
});
```

Each provider implements a specific interface and receives a context object with emit methods:

```typescript
interface STTProvider {
  metadata: { name: string; version: string; type: "stt" };
  start(ctx: STTContext): void;
  stop(): void;
  sendAudio(audio: Float32Array): void;
}
```

### Required Providers

| Provider | Interface                      | Purpose                |
| -------- | ------------------------------ | ---------------------- |
| STT      | `STTProvider`                  | Convert speech to text |
| LLM      | `LLMProvider` or `LLMFunction` | Generate responses     |
| TTS      | `TTSProvider`                  | Convert text to speech |

### Optional Providers

| Provider      | Interface              | Purpose                | Fallback             |
| ------------- | ---------------------- | ---------------------- | -------------------- |
| VAD           | `VADProvider`          | Detect voice activity  | STT's built-in VAD   |
| Turn Detector | `TurnDetectorProvider` | Detect turn boundaries | STT final transcript |

## Events

Subscribe to events via the `onEvent` callback:

```typescript
createAgent({
  // ...providers
  onEvent: (event) => {
    switch (event.type) {
      // Agent lifecycle
      case "agent:started":
      case "agent:stopped":
      case "agent:error":

      // Human turn events
      case "human-turn:started":
      case "human-turn:transcript": // { text, isFinal }
      case "human-turn:ended": // { transcript, metrics }
      case "human-turn:abandoned": // { reason }

      // AI turn events
      case "ai-turn:started":
      case "ai-turn:token": // { token }
      case "ai-turn:sentence": // { sentence, index }
      case "ai-turn:audio": // { audio: Float32Array }
      case "ai-turn:ended": // { text, wasSpoken, metrics }
      case "ai-turn:interrupted": // { partialText }

      // Debug events
      case "vad:probability": // { probability }
    }
  },
});
```

## Configuration

```typescript
interface AgentConfig {
  // Required providers
  stt: STTProvider;
  llm: LLMProvider | LLMFunction;
  tts: TTSProvider;

  // Optional providers
  vad?: VADProvider;
  turnDetector?: TurnDetectorProvider;

  // Barge-in configuration
  bargeIn?: {
    enabled?: boolean; // default: true
    minDurationMs?: number; // default: 200ms
  };

  // Audio format (applies to all providers)
  audioFormat?: {
    sampleRate: 8000 | 16000 | 22050 | 24000 | 44100 | 48000; // default: 24000
    channels: 1 | 2; // default: 1 (mono)
    bitDepth: 16 | 32; // default: 32 (Float32Array)
  };

  // Event handler
  onEvent?: (event: AgentEvent) => void;
}
```

## Agent API

```typescript
interface Agent {
  readonly id: string;

  // Lifecycle
  start(): void;
  stop(): void;

  // Audio input
  sendAudio(audio: Float32Array): void;

  // State observation
  subscribe(callback: (state: AgentState) => void): () => void;
  getSnapshot(): AgentState;
}
```

## Implementing Custom Providers

Create providers that match the interface contracts:

```typescript
import type { STTProvider, STTContext } from "voice-ai";

export function createMySTT(settings: MySTTSettings): STTProvider {
  return {
    metadata: {
      name: "MySTT",
      version: "1.0.0",
      type: "stt",
    },

    start(ctx: STTContext) {
      // Connect to your STT service
      // Call ctx.transcript(text, isFinal) when transcripts arrive
      // Call ctx.speechStart() / ctx.speechEnd() for VAD events
      // Respect ctx.signal for cancellation
    },

    stop() {
      // Clean up resources
    },

    sendAudio(audio: Float32Array) {
      // Send audio to your STT service
    },
  };
}
```

For LLM providers, you can use either the full interface or a simple function:

```typescript
import type { LLMFunction } from "voice-ai";

// Simple function approach
const llm: LLMFunction = async (ctx) => {
  const response = await openai.chat.completions.create(
    {
      model: "gpt-4",
      messages: ctx.messages,
      stream: true,
    },
    { signal: ctx.signal },
  );

  let fullText = "";
  for await (const chunk of response) {
    const token = chunk.choices[0]?.delta?.content || "";
    ctx.token(token);
    fullText += token;
  }
  ctx.complete(fullText);
};
```

## Development

```bash
# Install dependencies
bun install

# Development mode
bun run dev

# Build
bun run build

# Test
bun run test
bun run test:watch

# Code quality
bun run lint
bun run format
bun run typecheck
```

## Monorepo Structure

```
voice-ai/
├── packages/
│   └── voice-ai/          # Main orchestration library
├── tooling/
│   └── tsconfig/          # Shared TypeScript configs
├── turbo.json             # Turborepo configuration
└── package.json           # Root workspace
```

## Requirements

- Node.js >= 20
- Bun >= 1.3.5 (package manager)

## License

Apache-2.0
