# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript monorepo for `voice-ai`, an orchestration library for building real-time voice AI agents. It coordinates Speech-to-Text (STT), Language Models (LLM), Text-to-Speech (TTS), and audio playback using XState's actor model.

**Key insight**: This is pure orchestration—users bring their own providers via factory functions. The library provides zero STT/LLM/TTS implementations.

## Monorepo Structure

```
voice-ai/
├── packages/
│   └── voice-ai/          # Main orchestration library
├── tooling/
│   └── tsconfig/          # Shared TypeScript configs
├── turbo.json             # Turborepo task configuration
└── package.json           # Root workspace package
```

For detailed package architecture, see `packages/voice-ai/claude.md`.

## Commands

All commands run from the root directory via Turborepo:

```bash
# Development
bun run dev              # Watch mode for all packages
bun run build            # Build all packages

# Testing
bun run test             # Run all tests once
bun run test:watch       # Run tests in watch mode

# Code quality
bun run lint             # Run oxlint
bun run format           # Format with oxfmt
bun run format:check     # Check formatting
bun run typecheck        # TypeScript type checking

# Cleanup
bun run clean            # Remove node_modules, dist, .turbo
```

To run commands in a specific package:
```bash
cd packages/voice-ai && bun run test
```

To run a single test file:
```bash
cd packages/voice-ai && bun vitest run test/unit/actors/stt.test.ts
```

## Code Style

- **Linter**: oxlint (see `.oxlintrc.json`)
- **Formatter**: oxfmt (see `.oxfmtrc.json`)
- 2-space indentation, double quotes, semicolons, trailing commas
- Strict TypeScript with `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`

## Architecture Summary

- **Actor Model**: Each component (STT, LLM, TTS, VAD, turn detector, streamer) runs as an isolated XState actor
- **Two-layer Event System**:
  - Public events (`category:action`) exposed to users via `onEvent`
  - Internal events (`_category:action`) for machine-only communication
- **Provider Pattern**: Factory functions like `createDeepgramSTT({ apiKey })` return provider objects with metadata and lifecycle methods
- **Audio Format**: All audio is `Float32Array`
- **Message Immutability**: Never mutate arrays; always create new ones

## Key Conventions

- Events use discriminated unions for type safety
- Actors emit internal events (prefixed with `_`); machine translates to public events
- Providers receive context objects with emit methods and AbortSignal
- AbortErrors are silently ignored (expected during cancellation)
- Types use `PascalCase`, variables use `camelCase`
