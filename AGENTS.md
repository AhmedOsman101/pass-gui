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
pnpm format            # Biome auto-fix
pnpm format:unsafe     # Unsafe auto-fix
pnpm test:unit         # Run Vitest
pnpm test:unit path/to/file.test.ts  # Single test
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
- ES5 trailing commas, shorthand where possible

## Error Handling

**Mandatory**: All operations that can fail must return `Result<T, E>`

```typescript
import { Ok, ErrFromObject, ErrFromUnknown } from "lib-result";
import type { PassError } from "@/types/error";
async function listPasswords(): Promise<Result<PasswordEntry[], PassError>> {
  try {
    const output = await neutralino.execCommand("pass", ["ls"]);
    if (output.exitCode !== 0) {
      return ErrFromObject({
        message: "Command failed",
        type: "CommandFailed",
        command: "pass ls",
        exitCode: output.exitCode,
      });
    }
    return Ok(parsePasswordList(output.stdout));
  } catch (error) {
    return ErrFromUnknown(error);
  }
}
```

Error variants: `CommandFailed`, `ParsingError`, `GPGError`, `NotFound`, `ValidationError`
Never throw: Use `ErrFromObject()` or `Err()` instead of throw for expected failures

## Architecture

### Services Layer

Use services for NeutralinoJS calls, don't call directly in components

### Pinia Stores

State flat, actions return results, use `computed()` for derived state

### Vue Router

Lazy loading for pages: `component: () => import('@/views/HomeView.vue')`

### NeutralinoJS

Already initialized in `main.ts` (do NOT re-initialize)
Allowed APIs: `os.execCommand`, `clipboard.*`, `storage.*`, `filesystem.*`

## Password Stores

**Valid only**:

1. `$PASSWORD_STORE_DIR` (default if set)
2. `$HOME/.password-store` (default fallback)
3. Prompt the user to create a store if none of them were found.

**DO NOT**: Search arbitrary paths, validate by checking for `.gpg-id` file

## Testing

**Unit tests**: `client/src/**/*.test.ts` or `*.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

describe("PassService", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("should list passwords", async () => {
    const service = new PassService();
    const result = await service.listPasswords();
    expect(result.isOk()).toBe(true);
  });
});
```

Mock services, not UI components. Aim for >80% coverage on services and stores.

## Security

**NEVER**: Log plaintext passwords, store passwords in plain text in state, send passwords through console.log, include passwords in error messages

**ALWAYS**: Mask passwords with `•••••`, clear clipboard after timeout, use GPG agent for passphrase, validate all user inputs

## Before Changes

1. Run `pnpm typecheck` - must pass
2. Run `pnpm lint` - should have no errors
3. Run `pnpm test:unit` - should all pass
4. Check existing patterns for style consistency
5. Review `roadmap/phased-development-roadmap.md` for phase status

## Summary Checklist

- [ ] Use `pnpm typecheck` before committing
- [ ] Use `pnpm lint` to ensure code quality
- [ ] Use `pnpm test:unit` to verify tests
- [ ] Use `fd` instead of `ls` for file checks
- [ ] Use `-L` flag on `fd` when following symlinks
- [ ] Use `eza -T --all --ignore-glob="..."` for directory listings
- [ ] Return `Result<T, E>` from all operations that may error
- [ ] Use TypeScript types, avoid `any`
- [ ] Follow Biome formatting (80 char width, 2 space indent)
- [ ] Use composition API in Vue 3 components
- [ ] Keep components focused and reusable
- [ ] Use services layer for NeutralinoJS calls
- [ ] Mask passwords in logs and UI
- [ ] Follow existing naming conventions

---

**Last Updated**: January 12, 2026
