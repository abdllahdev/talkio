# @vox/deepgram

Deepgram STT and TTS providers for [vox](https://github.com/abdllahdev/voice-ai). Uses Deepgram's WebSocket APIs for streaming.

## Installation

```bash
bun add @vox/deepgram
# or
npm install @vox/deepgram
# or
pnpm add @vox/deepgram
```

**Peer Dependencies**: This package requires `@vox/core` to be installed.

## Quick Start

```typescript
import { createAgent } from "@vox/core";
import { createDeepgram } from "@vox/deepgram";

const deepgram = createDeepgram({
  apiKey: process.env.DEEPGRAM_API_KEY,
});

const agent = createAgent({
  stt: deepgram.stt({ model: "nova-3" }),
  tts: deepgram.tts({ model: "aura-2-thalia-en" }),
  llm: myLLMProvider,
  streamer: myAudioStreamer,
});

agent.start();
```

## Usage

### Provider Instance (Recommended)

Create a shared Deepgram instance to reuse configuration across STT and TTS:

```typescript
import { createDeepgram } from "@vox/deepgram";

const deepgram = createDeepgram({
  apiKey: process.env.DEEPGRAM_API_KEY,
  baseUrl: "api.deepgram.com", // optional, for enterprise/proxy
});

// Create providers with shared config
const stt = deepgram.stt({ model: "nova-3" });
const tts = deepgram.tts({ model: "aura-2-thalia-en" });
```

### Direct Imports

For more control, import the factory functions directly:

```typescript
import { createDeepgramSTT, createDeepgramTTS } from "@vox/deepgram";

const stt = createDeepgramSTT({
  apiKey: process.env.DEEPGRAM_API_KEY,
  model: "nova-3",
  language: "en",
  interimResults: true,
  punctuate: true,
  smartFormat: true,
});

const tts = createDeepgramTTS({
  apiKey: process.env.DEEPGRAM_API_KEY,
  model: "aura-2-thalia-en",
});
```

## API Reference

### `createDeepgram(settings?)`

Creates a Deepgram provider instance with shared configuration.

```typescript
interface DeepgramProviderSettings {
  apiKey?: string; // Falls back to DEEPGRAM_API_KEY env var
  baseUrl?: string; // Default: "api.deepgram.com"
}
```

Returns an object with `stt()` and `tts()` factory methods.

### `createDeepgramSTT(options)`

Creates a Speech-to-Text provider.

```typescript
interface DeepgramSTTOptions {
  // Required
  model: string; // e.g., "nova-3", "nova-2"

  // Optional
  apiKey?: string; // Falls back to provider settings or env var
  baseUrl?: string; // Falls back to provider settings
  language?: string; // Default: "en"
  interimResults?: boolean; // Default: true
  punctuate?: boolean; // Default: true
  smartFormat?: boolean; // Default: true
  endpointing?: number | false; // Default: 300 (ms)
  utteranceEndMs?: number; // Default: 1000 (ms)
  keywords?: string[]; // Domain-specific terms to boost
  vad?: boolean; // Default: true
}
```

**Supported Models:**

- `nova-3` - Latest and most accurate
- `nova-2` - Fast and accurate
- `nova` - Original Nova model
- See [Deepgram Models](https://developers.deepgram.com/docs/models) for full list

**Supported Input Formats:**

| Encoding   | Sample Rates                 | Default  |
| ---------- | ---------------------------- | -------- |
| `linear16` | 8000, 16000, 24000, 48000 Hz | 16000 Hz |
| `mulaw`    | 8000 Hz                      | -        |
| `alaw`     | 8000 Hz                      | -        |

The provider automatically uses its default format (`linear16` at 16000 Hz) unless you specify `audio.input` in `createAgent()`.

### `createDeepgramTTS(options)`

Creates a Text-to-Speech provider.

```typescript
interface DeepgramTTSOptions {
  // Required
  model: string; // e.g., "aura-2-thalia-en"

  // Optional
  apiKey?: string; // Falls back to provider settings or env var
  baseUrl?: string; // Falls back to provider settings
}
```

**Voice Format:**

- Aura 2 voices: `aura-2-{voice}-{language}` (e.g., `aura-2-thalia-en`)
- See [Deepgram TTS Models](https://developers.deepgram.com/docs/tts-models) for available voices

**Supported Output Formats:**

| Encoding   | Sample Rates                 | Default  |
| ---------- | ---------------------------- | -------- |
| `linear16` | 8000, 16000, 24000, 48000 Hz | 24000 Hz |
| `mulaw`    | 8000 Hz                      | -        |
| `alaw`     | 8000 Hz                      | -        |

The provider automatically uses its default format (`linear16` at 24000 Hz) unless you specify `audio.output` in `createAgent()`.

## Configuration

### API Key

The API key can be provided in three ways (in order of precedence):

1. Directly in options: `createDeepgramSTT({ apiKey: "..." })`
2. Via provider settings: `createDeepgram({ apiKey: "..." })`
3. Environment variable: `DEEPGRAM_API_KEY`

### Custom Base URL

For enterprise deployments or proxies:

```typescript
const deepgram = createDeepgram({
  apiKey: process.env.DEEPGRAM_API_KEY,
  baseUrl: "your-proxy.example.com",
});
```

## Examples

### Full Agent Setup

```typescript
import { createAgent } from "@vox/core";
import { createDeepgram } from "@vox/deepgram";

const deepgram = createDeepgram();

const agent = createAgent({
  stt: deepgram.stt({
    model: "nova-3",
    language: "en",
    keywords: ["voice-ai", "Deepgram"], // Boost recognition
  }),
  tts: deepgram.tts({
    model: "aura-2-thalia-en",
  }),
  llm: myLLMProvider,
  streamer: myAudioStreamer,
  onEvent: (event) => {
    if (event.type === "human-turn:transcript") {
      console.log("Transcript:", event.transcript);
    }
  },
});

agent.start();
```

### Custom Audio Formats

Override the default audio formats when needed:

```typescript
const agent = createAgent({
  stt: deepgram.stt({ model: "nova-3" }),
  tts: deepgram.tts({ model: "aura-2-thalia-en" }),
  llm: myLLMProvider,
  // Specify custom formats
  audio: {
    input: { encoding: "linear16", sampleRate: 24000, channels: 1 },
    output: { encoding: "linear16", sampleRate: 48000, channels: 1 },
  },
});
```

### Multi-language Support

```typescript
const stt = createDeepgramSTT({
  model: "nova-3",
  language: "es", // Spanish
});
```

See [Deepgram Languages](https://developers.deepgram.com/docs/languages) for supported languages.

## License

Apache-2.0
