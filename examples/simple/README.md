# Simple Voice Agent Example

A minimal example demonstrating real-time voice conversations using `voice-ai`.

## Features

- Real-time voice input via browser microphone
- Speech-to-text using Deepgram Nova 3
- LLM responses using OpenAI GPT-4o-mini
- Text-to-speech using Deepgram Aura 2
- Interruption support - speak to interrupt the agent
- Audio conversion utilities from `voice-ai`

## Prerequisites

- [Bun](https://bun.sh) installed
- Deepgram API key (get one at [deepgram.com](https://deepgram.com))
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))

## Setup

1. Create a `.env.local` file with your API keys:

```bash
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
```

2. Install dependencies:

```bash
bun install
```

3. Start the development server:

```bash
bun dev
```

4. Open http://localhost:3000 in your browser and click "Start Conversation"

## Architecture

```
Browser (client.tsx)          Server (server.ts)
┌─────────────────────┐       ┌──────────────────────────┐
│ Microphone          │       │ voice-ai Agent         │
│   ↓                 │       │   ├── STT (Deepgram)     │
│ ScriptProcessor     │       │   ├── LLM (OpenAI)       │
│   ↓                 │       │   └── TTS (Deepgram)     │
│ float32ToLinear16() │       │                          │
│   ↓                 │──ws──→│ sendAudio() accepts:     │
│ WebSocket send      │       │   - ArrayBuffer          │
└─────────────────────┘       │   - Uint8Array           │
                              │   - Buffer (Node.js)     │
┌─────────────────────┐       │   (auto-converted)       │
│ linear16ToFloat32() │←─ws───│                          │
│   ↓                 │       └──────────────────────────┘
│ AudioBufferSource   │
│   ↓                 │
│ Speakers            │
└─────────────────────┘
```

## Audio Format

- **Input**: 16kHz mono Linear16 PCM
- **Output**: 24kHz mono Linear16 PCM

The client uses `voice-ai` audio conversion utilities:

- `float32ToLinear16()` - Convert Web Audio API Float32Array to Linear16
- `linear16ToFloat32()` - Convert Linear16 to Float32Array for playback

## Key Code Highlights

### Server: Accepting Multiple Audio Input Types

```typescript
// server.ts - sendAudio() accepts multiple input types directly
websocket: {
  message(ws, message) {
    if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
      session.agent.sendAudio(message);
    }
  },
}
```

### Client: Using Core Audio Utilities

```typescript
// client.tsx - Using voice-ai conversion functions
import { float32ToLinear16, linear16ToFloat32 } from "voice-ai";

// Sending audio from microphone
processor.onaudioprocess = (e) => {
  const float32 = e.inputBuffer.getChannelData(0);
  const pcm16 = float32ToLinear16(float32);
  ws.send(pcm16);
};

// Playing received audio
const float32 = linear16ToFloat32(buffer);
audioBuffer.getChannelData(0).set(float32);
```

## Available Audio Utilities

`voice-ai` provides comprehensive audio conversion utilities:

```typescript
import {
  // Format conversion
  float32ToLinear16, // Float32Array → ArrayBuffer (Linear16)
  linear16ToFloat32, // ArrayBuffer → Float32Array
  float32ToInt16, // Float32Array → Int16Array
  int16ToFloat32, // Int16Array → Float32Array

  // Channel conversion
  stereoToMono, // Stereo → Mono (Float32Array or Int16Array)

  // Resampling
  resample, // Float32Array resampling
  resampleInt16, // Int16Array resampling

  // Telephony codecs
  mulawToLinear16, // G.711 μ-law → Linear16
  alawToLinear16, // G.711 A-law → Linear16
  linear16ToMulaw, // Linear16 → G.711 μ-law
  linear16ToAlaw, // Linear16 → G.711 A-law
} from "voice-ai";
```

## Production

Build and run for production:

```bash
bun run build
bun start
```
