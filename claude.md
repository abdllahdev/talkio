# CLAUDE.md

Development guide for the voice-ai monorepo.

## Monorepo Structure

```
voice-ai/
├── packages/
│   ├── voice-ai/        # Core orchestration library
│   └── deepgram/        # @voice-ai/deepgram provider
├── tooling/
│   └── tsconfig/        # Shared TypeScript configs
├── turbo.json           # Turborepo configuration
└── package.json         # Root workspace
```

Each package has its own `CLAUDE.md` with package-specific guidance.

## Commands

Run from root directory:

```bash
bun run dev           # Watch mode
bun run build         # Build all packages
bun run test          # Run tests
bun run test:watch    # Watch mode tests
bun run typecheck     # Type checking
bun run lint          # oxlint
bun run format        # oxfmt
bun run clean         # Remove dist, node_modules, .turbo
```

Run in specific package:

```bash
cd packages/voice-ai && bun run test
cd packages/voice-ai && bun vitest run test/unit/actors/stt.test.ts
```

## Code Style

- **Linter**: oxlint (`.oxlintrc.json`)
- **Formatter**: oxfmt (`.oxfmtrc.json`)
- 2-space indentation
- Double quotes
- Semicolons required
- Trailing commas

## TypeScript

- Strict mode enabled
- `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`
- Use `type` for aliases, `interface` for extensible shapes
- Prefer discriminated unions over string unions
- Avoid `any` — use `unknown` with type guards

## Naming

- Types: `PascalCase`
- Variables/functions: `camelCase`
- Files: `kebab-case.ts`
- Test files: `*.test.ts`

## Testing

- Framework: Vitest
- Unit tests: `test/unit/`
- Integration tests: `test/integration/`
- Use `vi.waitFor()` for async assertions

## Comments

**STRICT RULES - NEVER VIOLATE:**

- **NO decorative comments** — no banners, separators, or visual decorations
- **NO inline comments about changes** — never add comments like "// Changed this", "// Updated", "// Fixed", etc.
- **NO obvious comments** — don't comment what the code already clearly shows
- Comments should ONLY explain **why**, not **what** or **how**
- Only add comments when they provide non-obvious context or explain complex logic
- Prefer self-documenting code over comments
