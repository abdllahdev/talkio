# talkio Package

Orchestration library for realtime voice AI agents using XState's actor model.

**Key insight**: Pure orchestration — users bring their own providers.

## Structure

```
src/
├── agent/
│   ├── machine.ts        # XState state machine
│   ├── context.ts        # Machine context types
│   ├── create-agent.ts   # Public API (createAgent)
│   └── actors/           # STT, LLM, TTS, VAD, turn-detector, streamer
├── audio/
│   ├── types.ts          # AudioEncoding, AudioFormat
│   └── conversions.ts    # encodeAudio, decodeAudio
├── providers/
│   ├── types.ts          # Provider interfaces
│   └── factories.ts      # createCustom*Provider functions
├── types/
│   ├── events.ts         # Public and internal events
│   ├── config.ts         # AgentConfig
│   └── common.ts         # Message types
└── index.ts              # Public exports
```

## Core Concepts

### Actor Model

Each component runs as an isolated XState actor:

- No shared state — communication through events
- Automatic cleanup via AbortSignal
- Actors: `stt`, `llm`, `tts`, `vad`, `turn-detector`, `streamer`

### Two-Layer Events

| Layer    | Prefix | Example            | Visibility         |
| -------- | ------ | ------------------ | ------------------ |
| Public   | none   | `human-turn:ended` | `onEvent` callback |
| Internal | `_`    | `_stt:transcript`  | Machine only       |

Machine translates internal → public events.

### Providers

Required: `STTProvider`, `LLMProvider`, `TTSProvider`
Optional: `VADProvider`, `TurnDetectorProvider`

**STT/TTS providers are generic over their format types:**

- `STTProvider<InputFormat>` — declares `supportedInputFormats` and `defaultInputFormat`
- `TTSProvider<OutputFormat>` — declares `supportedOutputFormats` and `defaultOutputFormat`

Each receives a context with emit methods and `signal: AbortSignal`.

## Key Files

| File                     | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `agent/machine.ts`       | State machine (idle → running → stopped)           |
| `agent/create-agent.ts`  | `createAgent()` factory, returns `Agent` interface |
| `types/events.ts`        | `PublicAgentEvent`, `InternalAgentEvent` unions    |
| `providers/types.ts`     | All provider interfaces                            |
| `providers/factories.ts` | `createCustom*Provider` helpers                    |

## Patterns

### Actor Implementation

```typescript
// actors/stt.ts
fromCallback(({ sendBack, input }) => {
  input.config.stt.start({
    transcript: (text, isFinal) => sendBack({ type: "_stt:transcript", text, isFinal }),
    signal: input.abortSignal,
  });
  return () => input.config.stt.stop();
});
```

### Adding Events

**Internal event:**

1. Add to `InternalAgentEvent` in `types/events.ts`
2. Emit from actor via `sendBack()`
3. Handle in `machine.ts`

**Public event:**

1. Add to `PublicAgentEvent` in `types/events.ts`
2. Add emit action in `machine.ts`
3. Export from `index.ts`

### Audio Format

**AudioFormat:**

- `encoding` — required (linear16, mulaw, opus, etc.)
- `sampleRate`, `channels` — optional, have encoding-based defaults

**NormalizedAudioFormat:**

- All fields required (after `normalizeFormat()`)

**Configuration:**

- `AgentConfig.audio?: { input: AudioFormat, output: AudioFormat }` — optional, uses provider defaults if omitted
- `NormalizedAgentConfig.audio: NormalizedAudioConfig` — always defined (internal type)

**Provider Format Declaration:**

- STT: `supportedInputFormats`, `defaultInputFormat`
- TTS: `supportedOutputFormats`, `defaultOutputFormat`

**Encoding Categories:**

- PCM: `linear16`, `linear32`, `float32`
- Telephony: `mulaw`, `alaw`
- Compressed: `opus`, `ogg-opus`, `flac`, `mp3`, `aac`
- Container: `wav`, `webm`, `ogg`, `mp4`

**Audio is passed through to providers without conversion.** Providers handle their own decoding.

## Conventions

- Events: discriminated unions (never string literals)
- AbortErrors: silently ignored (expected during cancellation)
- Messages: never mutate — always spread to new array
- Providers: report errors via `ctx.error()`, not throw

## Comments

**STRICT RULES - NEVER VIOLATE:**

- **NO decorative comments** — no banners, separators, or visual decorations
- **NO inline comments about changes** — never add comments like "// Changed this", "// Updated", "// Fixed", etc.
- **NO obvious comments** — don't comment what the code already clearly shows
- Comments should ONLY explain **why**, not **what** or **how**
- Only add comments when they provide non-obvious context or explain complex logic
- Prefer self-documenting code over comments
