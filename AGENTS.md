# AGENTS.md

Guidelines for agentic coding assistants on GNU Pass GUI project.

## Project Overview

**Type**: Desktop GUI for GNU Pass password manager
**Stack**: Vue 3 + Pinia + NeutralinoJS + TypeScript + TailwindCSS + shadcn-vue + lib-result
**Structure**: pnpm workspace (root + client/)
**Direction**: Backend-first; finish readiness and backend contracts before major frontend work

## Current Project Reality

- The repo is past the initial scaffold phase.
- Config loading, validation, and default config generation are already implemented.
- Core services for `pass`, `gpg`, filesystem access, and Neutralino command execution already exist.
- Frontend state and screens are still intentionally minimal.
- The current roadmap source of truth is the numbered sequence under `docs/roadmap/`.
- `TODO.md` at repo root is the authoritative checklist of remaining work.
- `docs/plans/` contains execution plans for each roadmap phase.
- `docs/specs/` contains detailed specs for specific subsystems.

## Known Architecture Issues

- **Module-level init promises**: `neuInitialized`, `gpgInitialized`, `passInitialized` in `main.ts` block app mount sequentially after `app.mount("#app")`. If any service init fails, the app never renders. The readiness orchestrator in roadmap phase 2 should fix this with graceful degradation (show blocked states instead of failing silently).

## Current Roadmap Order

Read in order:

1. `docs/roadmap/01-current-state-and-direction.md`
2. `docs/roadmap/02-backend-foundation-and-readiness.md`
3. `docs/roadmap/03-entry-and-operations-backend.md`
4. `docs/roadmap/04-frontend-after-backend.md`
5. `docs/roadmap/05-release-and-future-work.md`

## Commands

### Development

```bash
pnpm dev                # Parallel: frontend + NeutralinoJS
pnpm dev:neutralino     # With inspector
pnpm dev:frontend       # Vite dev server only
```

### Build & Test

```bash
pnpm typecheck          # Vue-TSC type checking
pnpm build:frontend     # Vite build only
pnpm build              # Full build (frontend + NeutralinoJS)
pnpm release            # Release build
```

### Lint & Test

```bash
pnpm lint              # Biome check
pnpm format            # Biome auto-fix (safe only)
pnpm format:unsafe     # Biome auto-fix (including unsafe)
```

### Typecheck

```bash
pnpm typecheck           # Root + client type checking
pnpm --filter=client typecheck  # Client only
```

### File Operations (for you, the agent to use not for the developer)

```bash
cd "$(git rev-parse --show-toplevel || echo .)" || exit                   # Git root
fd -L filename                                                            # File exists (PREFERRED, follows symlinks)
fd -L filename -e extension                                               # File exists (Search with name and extensions)
fd -t d -L dirname                                                        # Dir exists (follows symlinks)
eza -T --all --ignore-glob="node_modules|.tmp|dist|build|.husky|.git|bin" # Tree display of the cwd
```

## Code Style

### TypeScript

- Use explicit type imports, avoid namespace
- Define types in `types/` directory
- Use `types` for everything or until you need a specific feature of `interface`.
- Prefer explicit return types
- Prefer named functions

### Vue 3

- Use setup script: `<script setup lang="ts">`
- Define state first (`ref`), then computed
- Use `defineProps` and `defineEmits` with runtime options
- Use composition functions for shared logic

### Naming

- Files: `PascalCase.vue` (components), `use*.ts` (composables, kebab-case), `*.ts` (stores/services/utils), `*.ts` (types)
- Constants: `UPPER_SNAKE_CASE`, state: `camelCase`, funcs: `camelCase`, classes/types/interfaces/enums: `PascalCase`
- Imports: Third-party at top, internal with `@/` alias

### Formatting (Biome)

- 2 spaces indentation, 80 char width, LF only, double quotes for JSX/HTML
- ES5 trailing commas, semicolons always, arrow parentheses as needed, shorthand where possible

### Key Lint Rules

- `noVar`: on (use `let`/`const` only, never `var`)
- `useImportType`: error (explicit type imports required)
- `useTemplate`: warn (use template literals)
- `noExplicitAny`: info (avoid `any`, use `unknown` if needed)
- `noImportCycles`: error (no cyclic imports)
- `useThrowOnlyError`: on (only throw Error objects)
- `noUnusedVariables`: warn
- `noUnusedImports`: warn (auto-fixable)

### LSP Notes

- Biome LSP may panic on sudden file changes. If it emits false-positive errors, restart the LSP.

## Error Handling

**Mandatory**: All operations that can fail must return `Result<T, E>`

```typescript
import { Ok, ErrFromObject, ErrFromUnknown } from "lib-result";
import { PassError } from "@/lib/errors";
async function listPasswords(): Promise<Result<PasswordEntry[], PassError>> {
  try {
    const output = await neutralino.execCommand("pass", ["ls"]);
    if (output.exitCode !== 0) {
      return Err(
        new PassError({
          message: "Command failed",
          type: "CommandFailed",
          command: "pass ls",
          exitCode: output.exitCode,
        })
      );
    }
    return Ok(parsePasswordList(output.stdout));
  } catch (error) {
    return ErrFromUnknown(error);
  }
}
```

Error variants: Defined at `@/lib/errors.ts`
Never throw: Use `lib-result` wrapper methods like `wrap`, `wrapAsync`, `wrapThrowable` and `wrapAsyncThrowable` instead of throw for expected failures.

## Architecture

### Services Layer

Use services for NeutralinoJS calls, don't call directly in components

Available services (all in `client/src/services/`):

- `NeutralinoService` (`neutralino.ts`) — Command exec, binary resolution, env vars
- `fs` (`filesystem.ts`) — Filesystem abstraction (mkdir, exists, readFile, writeFile)
- `ConfigService` (`config.ts`) — Config load/save/ensure/getValue/setValue
- `config-validation.ts` — Zod schemas + validators
- `PassService` (`pass.ts`) — pass binary validation, version check, scoped exec
- `GpgService` (`gpg.ts`) — gpg/gpg2 detection, version, secret key listing
- `StoreService` (`store.ts`) — Store CRUD by name from config (path, gpg home validation)

### Backend-First Development Order

Prefer this implementation order:

1. Config and validation
2. Readiness and environment checks
3. Store validation
4. Entry operations and backend contracts
5. Pinia stores that consume those contracts
6. UI flows and components

### Pinia Stores

State flat, actions return results, use `computed()` for derived state

Do not invent backend behavior in stores. Stores should consume explicit
service and domain contracts.

### Vue Router

Lazy loading for pages: `component: () => import('@/views/HomeView.vue')`

### NeutralinoJS

Already initialized in `main.ts` (do NOT re-initialize)

## Password Stores

**Valid only**:

1. `$PASSWORD_STORE_DIR` (default if set)
2. `$HOME/.password-store` (default fallback)
3. Prompt the user to create a store if none of them were found.

**DO NOT** Search arbitrary paths.

Validate stores through the app's readiness and store-validation flow, not by
UI assumptions alone.

## Security

**NEVER**: Log plaintext passwords, store passwords in plain text in state, send passwords through console.log, include passwords in error messages

**ALWAYS**: Mask passwords with â¢â¢â¢â¢â¢, clear clipboard after timeout, use GPG agent for passphrase, validate all user inputs

## Before Changes

1. Run `pnpm typecheck` - must pass
2. Run `pnpm lint && pnpm format`
3. Check existing patterns for style consistency
4. Review the numbered roadmap files under `docs/roadmap/`
5. Check `docs/plans/` for any existing execution plans relevant to the work
6. Check `TODO.md` for checklist coverage

## Summary Checklist

- [ ] Use `pnpm typecheck` before committing
- [ ] Use `pnpm lint && pnpm format` to ensure code quality
- [ ] Return `Result<T, E>` from all operations that may error
- [ ] Use TypeScript types, avoid `any`
- [ ] Follow Biome formatting (80 char width, 2 space indent)
- [ ] Use composition API in Vue 3 components
- [ ] Keep components focused and reusable
- [ ] Use services layer for NeutralinoJS calls
- [ ] Keep backend and domain logic out of UI components and ad hoc store code
- [ ] Mask passwords in logs and UI
- [ ] Follow existing naming conventions
- [ ] Check `TODO.md` and `docs/plans/` before starting new work

---

**Last Updated**: June 15, 2026
