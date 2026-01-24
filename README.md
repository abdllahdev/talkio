# vox

Orchestration library for building realtime voice AI agents in TypeScript. Handles STT, LLM, and TTS coordination with automatic turn management and interruption detection.

## Installation

```bash
npm install @vox/core
```

## Quick Start

```typescript
import { createAgent } from "@vox/core";
import { createDeepgram } from "@vox/deepgram";

const deepgram = createDeepgram({ apiKey: process.env.DEEPGRAM_API_KEY });

const agent = createAgent({
  stt: deepgram.stt({ model: "nova-3" }),
  llm: myLLMProvider,
  tts: deepgram.tts({ model: "aura-2-thalia-en" }),
  onEvent: (event) => {
    switch (event.type) {
      case "human-turn:ended":
        console.log("User:", event.transcript);
        break;
      case "ai-turn:audio":
        playAudio(event.audio);
        break;
    }
  },
});

agent.start();
agent.sendAudio(audioChunk); // Float32Array from microphone
agent.stop();
```

## Events

```typescript
// Lifecycle
"agent:started";
"agent:stopped";
"agent:error"; // { error, source }

// Human turn
"human-turn:started";
"human-turn:transcript"; // { text, isFinal }
"human-turn:ended"; // { transcript }

// AI turn
"ai-turn:started";
"ai-turn:token"; // { token }
"ai-turn:sentence"; // { sentence, index }
"ai-turn:audio"; // { audio: ArrayBuffer }
"ai-turn:ended"; // { text, wasSpoken }
"ai-turn:interrupted"; // { partialText }
```

## Packages

| Package         | Description                |
| --------------- | -------------------------- |
| `@vox/core`     | Core orchestration library |
| `@vox/deepgram` | Deepgram STT/TTS providers |

```typescript
import { createDeepgram } from "@vox/deepgram";

const deepgram = createDeepgram({ apiKey: process.env.DEEPGRAM_API_KEY });

const agent = createAgent({
  stt: deepgram.stt({ model: "nova-3" }),
  tts: deepgram.tts({ model: "aura-2-thalia-en" }),
  llm: myLLMProvider,
});
```

## Audio Configuration

Configure separate input/output formats, or use provider defaults:

```typescript
const agent = createAgent({
  stt: mySTT,
  llm: myLLM,
  tts: myTTS,
  // Optional: specify audio formats (uses provider defaults if omitted)
  audio: {
    input: { encoding: "linear16", sampleRate: 16000, channels: 1 },
    output: { encoding: "linear16", sampleRate: 24000, channels: 1 },
  },
});
```

## Creating Providers

```typescript
import {
  createCustomSTTProvider,
  createCustomLLMProvider,
  createCustomTTSProvider,
} from "@vox/core";

const sttFormats = [
  { encoding: "linear16", sampleRate: 16000, channels: 1 },
  { encoding: "linear16", sampleRate: 24000, channels: 1 },
] as const;

const stt = createCustomSTTProvider({
  name: "MySTT",
  supportedInputFormats: sttFormats,
  defaultInputFormat: sttFormats[0],
  start: (ctx) => {
    /* ctx.transcript(text, isFinal) */
  },
  stop: () => {},
  sendAudio: (audio) => {},
});

const llm = createCustomLLMProvider({
  name: "MyLLM",
  generate: async (messages, ctx) => {
    // ctx.token(), ctx.sentence(), ctx.complete()
  },
});

const ttsFormats = [{ encoding: "linear16", sampleRate: 24000, channels: 1 }] as const;

const tts = createCustomTTSProvider({
  name: "MyTTS",
  supportedOutputFormats: ttsFormats,
  defaultOutputFormat: ttsFormats[0],
  synthesize: async (text, ctx) => {
    // ctx.audioChunk(), ctx.complete()
  },
});
```

All providers receive `ctx.signal` (AbortSignal) for cancellation.

## License

Apache-2.0
