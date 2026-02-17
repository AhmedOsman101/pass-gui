# AGENTS.md

Guidelines for agentic coding assistants on GNU Pass GUI project.

## Project Overview

**Type**: Desktop GUI for GNU Pass password manager
**Stack**: Vue 3 + Pinia + NeutralinoJS + TypeScript + TailwindCSS + shadcn-vue + lib-result
**Structure**: pnpm workspace (root + client/)
**Status**: Phase 1 (Foundation) - 70% complete

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
pnpm dist               # Release build
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
./pnpm-client typecheck  # Client only
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

### Pinia Stores

State flat, actions return results, use `computed()` for derived state

### Vue Router

Lazy loading for pages: `component: () => import('@/views/HomeView.vue')`

### NeutralinoJS

Already initialized in `main.ts` (do NOT re-initialize)

## Password Stores

**Valid only**:

1. `$PASSWORD_STORE_DIR` (default if set)
2. `$HOME/.password-store` (default fallback)
3. Prompt the user to create a store if none of them were found.

**DO NOT** Search arbitrary paths, validate by checking for `.gpg-id` file

## Security

**NEVER**: Log plaintext passwords, store passwords in plain text in state, send passwords through console.log, include passwords in error messages

**ALWAYS**: Mask passwords with `•••••`, clear clipboard after timeout, use GPG agent for passphrase, validate all user inputs

## Before Changes

1. Run `pnpm typecheck` - must pass
2. Run `pnpm lint` - should have no errors or warnings
3. Check existing patterns for style consistency
4. Review `roadmap/phased-development-roadmap.md` for phase status

## Summary Checklist

- [ ] Use `pnpm typecheck` before committing
- [ ] Use `pnpm lint` to ensure code quality
- [ ] Return `Result<T, E>` from all operations that may error
- [ ] Use TypeScript types, avoid `any`
- [ ] Follow Biome formatting (80 char width, 2 space indent)
- [ ] Use composition API in Vue 3 components
- [ ] Keep components focused and reusable
- [ ] Use services layer for NeutralinoJS calls
- [ ] Mask passwords in logs and UI
- [ ] Follow existing naming conventions

---

**Last Updated**: February 17, 2026
