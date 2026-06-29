# pass-gui Context File

> Handoff document for AI agents reviewing or working on the pass-gui project.
> Last updated: June 30, 2026

---

## What is pass-gui

A **desktop GUI for GNU Pass** (the standard Unix password manager). It wraps `pass` and GPG under a graphical interface using NeutralinoJS (a lightweight alternative to Electron). It manages multiple password stores, validates environment readiness, lists entries, and provides clipboard-backed copy operations.

**Tech stack**: Vue 3 + Pinia + NeutralinoJS + TypeScript + TailwindCSS v4 + shadcn-vue + lib-result + Zod + `@ltd/j-toml`

---

## Project Structure

```
pass-gui/
├── AGENTS.md                    # Agent guidelines (code style, architecture, commands)
├── TODO.md                      # Authoritative checklist of remaining work
├── biome.json                   # Biome linter/formatter (sole lint tool, no ESLint)
├── neutralino.config.json       # NeutralinoJS app config
├── docs/
│   ├── specs/                   # Stable scoping specs per phase
│   ├── plans/                   # Execution plans per phase
│   └── references/              # NeutralinoJS + j-toml API docs
└── client/src/
    ├── main.ts                  # Entry point: mounts Vue, inits services
    ├── App.vue                  # Root component (Vue logo + RouterView stub)
    ├── types/                   # All type definitions
    │   ├── index.ts              # Brand, Version, PassBinaryInfo, SecretKey, etc.
    │   ├── config.ts             # AppConfig, CoreConfig, StoreConfig, etc.
    │   └── toml.ts               # TomlObject, ParsedToml, etc.
    ├── lib/
    │   ├── errors.ts             # NeuError, FileWriteError, ConfigError, etc.
    │   ├── constants.ts          # PASS_MIN_VERSION (1.7.0), DEFAULT_CONFIG
    │   ├── utils.ts              # cn(), compareVersions(), brand()
    │   ├── path.ts               # expandTilde(), resolveUserPath()
    │   ├── shell.ts              # Shell quoting, path traversal prevention
    │   └── toml.ts               # TOML parse/stringify with comment preservation
    ├── services/                 # Backend service layer (all singletons)
    │   ├── neutralino.ts         # NeutralinoService: command exec, binary resolution
    │   ├── filesystem.ts         # fs class: mkdir, exists, readFile, writeFile
    │   ├── config.ts             # ConfigService: load/save/ensure/getValue/setValue
    │   ├── config-validation.ts  # Zod schemas per config section
    │   ├── pass.ts               # PassService: binary check, version, scoped exec
    │   ├── gpg.ts                # GpgService: gpg2/gpg detection, secret key listing
    │   └── store.ts              # StoreService: CRUD stores from config
    ├── stores/
    │   └── counter.ts            # Placeholder store only (template artifact)
    ├── pages/
    │   ├── index.vue             # Home page (RouterLink stub)
    │   ├── about.vue             # Static stub
    │   └── test.vue              # Runs hardcoded service calls for testing
    └─ components/
        ├── AppSidebar.vue        # Sidebar with hardcoded sample data (not real)
        ├── ModeToggle.vue        # Dark/light/system mode toggle (works)
        ├── Tree.vue              # Recursive file tree (wired to sample data)
        └── ui/                   # shadcn-vue components (button, sidebar, etc.)
```

---

## Architecture

### Layering

```
config -> readiness -> entry operations -> state contracts -> UI
```

Each layer depends on the one before it. The app is currently between layers 1 (config) and 2 (readiness).

### Services Layer

Six service singletons, all in `client/src/services/`:

**⚠️ `neu.execCmd()` throws on non-zero exit** — Line 95-98 of `neutralino.ts` draws a hard error if exit code != 0. This blocks Phase 03 (entry operations) where non-zero exits carry semantic meaning (e.g. `pass show` exits 1 for "entry not found"). Entry operations need a variant that returns exit code without throwing.

**⚠️ Module-level init promises** — `gpgInitialized` and `passInitialized` are imported and awaited in `main.ts` (lines 22-23). If any service init fails, the app never renders. The readiness orchestrator runs after init but does not replace the blocking behavior yet.

| Service        | File            | Purpose                                                   |
| -------------- | --------------- | --------------------------------------------------------- |
| `neu`          | `neutralino.ts` | NeutralinoJS command exec, binary resolution, env vars    |
| `fs`           | `filesystem.ts` | mkdir, exists, readFile, writeFile, isDirectory, getStats, join, readDirectory |
| `config`       | `config.ts`     | Load/save/ensure config, generic getValue/setValue        |
| `pass`         | `pass.ts`       | pass binary validation, version check, exec, execScoped  |
| `gpg`          | `gpg.ts`        | gpg2/gpg detection, version parsing, secret key listing, exec, listSecretKeysWithHome |
| `StoreService` | `store.ts`      | get/set/validatePath for stores from config               |
| `StoreValidationService` | `store-validation.ts` | .gpg-id parsing, recipient verification, behavioral check |

### Init Flow (main.ts)

```ts
// main.ts — current architecture
Neutralino.init();
await neuInitialized; // from neutralino.ts
await gpgInitialized; // from gpg.ts
await passInitialized; // from pass.ts
```

**Known issue**: These are module-level promise singletons. App mounts via `app.mount("#app")` BEFORE the awaits, but if any init fails, there is no graceful degradation. Phase 2 (readiness) is supposed to fix this.

### Pinia Stores

Only one exists: `useCounterStore` (template placeholder). All stores must be setup stores (function form), return `Result` types from actions, and consume service contracts — not invent backend behavior.

### Error Handling

**Mandatory**: `Result<T, E>` from `lib-result` for everything that can fail. Never throw for expected failures.

```ts
import { Ok, Err, ErrFromObject, ErrFromUnknown } from "lib-result";

async function doSomething(): Promise<Result<ResultType, ErrorType>> {
  // try / wrap / wrapAsync — never throw
}
```

Error classes in `client/src/lib/errors.ts`:

- `NeuError` (+ `DirectoryCreationError`, `FileWriteError`) — NeutralinoJS errors
- `ConfigNotFoundError`, `ConfigParseError`, `ConfigWriteError`, `ConfigValidationError` — config errors

---

## Current State: What is IMPLEMENTED

- **pnpm workspace** (root + client/) with full build: Vite 7, Neutralino 6, Vue 3.5, TypeScript 5.9, Tailwind v4
- **Config system** — load/save/ensure/getValue/setValue with Zod validation, TOML comment preservation via `@ltd/j-toml`, cross-field validation (active_store references valid store), commented default config on first write
- **NeutralinoService** — command execution with ANSI stripping, binary resolution with symlink following, env var access, command existence checking, path traversal prevention
- **Filesystem service** — mkdir, exists, readFile, writeFile, isDirectory, isFile, getStats, normalize, join, path parts
- **PassService** — binary validation, version check (min 1.7.0), `pass` exec with PASSWORD_STORE_DIR scoping, path validation
- **GpgService** — gpg2/gpg detection, version parsing, home directory detection, secret key listing with colon-parsed output, GNUPGHOME scoping
- **StoreService** — basic store get/set/validatePath from config
- **Shell security** — POSIX/Windows quoting, argument validation, directory traversal detection (`../`, null bytes)
- **shadcn-vue** — installed: sidebar (full suite), button, input, separator, skeleton, tooltip, breadcrumb, sheet, collapsible, dropdown-menu
- **Dark/light mode** — via `@vueuse/core` useColorMode (works)
- **File-based routing** — Vue Router uses file-based routing from pages/

---

## Current State: What is NOT IMPLEMENTED

### Readiness Layer (phase 02 — MOSTLY COMPLETE)

- ✅ `ReadinessState` (10-state union), `ReadinessSnapshot`, `ReadinessIssue` (discriminated union) at `client/src/types/readiness.ts`
- ✅ Store validation service at `client/src/services/store-validation.ts` (parseGpgId, verifyRecipients, validateBehavior, hasEntries)
- ✅ Readiness orchestrator at `client/src/services/readiness.ts` (checkPass, checkTree, checkGpg, checkGpgKeys, checkStore, checkStoreEmpty)
- ✅ Readiness wired into `main.ts` (logs result to debug)
- ✅ `STORE_ERROR_CODES`, `StoreValidationError` at `client/src/lib/errors.ts`
- ✅ `readiness-helper.ts` — issue() factory, SEVERITY record
- ❌ No readiness Pinia store (Phase 04)
- ❌ Module-level init promises still block app mount (no graceful degradation)

### Entry Operations (phase 03)

- No entry listing (`pass ls` parsing into tree structure)
- No entry detail retrieval (`pass show` -> secret + metadata)
- No entry mutations (insert, generate, edit, rm, mv)
- No clipboard service (Neutralino clipboard API not called)
- No entry domain types (entry tree, entry detail, mutation result)

### Pinia Stores (beyond counter stub)

- No readiness store
- No entries store
- No selected entry store
- No clipboard store
- No store-context store

### Frontend (phase 04)

- No readiness-driven app entry (blocked screens for missing deps)
- No password list view
- No entry detail view
- No onboarding flows (missing pass, missing GPG keys, store creation)
- App.vue is just a logo + RouterView — no app shell
- AppSidebar.vue uses hardcoded sample data, not real pass output
- Test page runs hardcoded service calls for development only

### Security (partial)

- Clipboard clearing not implemented
- Sensitive data not cleared from memory
- GPG agent passphrase handling not wired

---

## Type System

All in `client/src/types/`:

```ts
// index.ts
type Brand<T, TBrand> = T & { [__brand]: TBrand };
type Version = { major: number; minor: number; patch: number };
type PassBinaryInfo = { path: string; isSystemBinary: boolean };
type GpgBinaryInfo = { path: string; command: string };
type SecretKey = {
  keyId: string;
  fingerprint?: string;
  userId: string;
  userIds: string[];
  algorithm: string;
  creationDate: string | null;
  expirationDate: string | null;
};
type AllowedCommand =
  | "pass"
  | "gpg"
  | "gpg2"
  | "type"
  | "ls"
  | "where.exe"
  | "which"
  | "readlink"
  | "file";
type OsType = "Linux" | "Darwin" | "Windows NT" | "Unknown";

// config.ts
type AppConfig = {
  core: CoreConfig; // { active_store: string }
  preferences: PreferencesConfig; // { auto_refresh_interval_ms: number }
  generation: GenerationConfig; // { default_length, symbols, character_set, character_set_no_symbols }
  clipboard: ClipboardConfig; // { clear_after_seconds, selection }
  gpg: GpgConfig; // { opts: string[], signing_key?, key? }
  extensions: ExtensionsConfig; // { enabled: boolean }
  stores: Record<string, StoreConfig>; // { path: string, gnupg_home?: string }
};
```

---

## Code Style Rules

- **TypeScript**: `type` over `interface`, explicit type imports (`useImportType: error`), named functions preferred, no `any` (use `unknown`), no `enum`
- **Vue 3**: `<script setup lang="ts">`, Composition API, state first then computed then functions, `defineProps`/`defineEmits` with runtime options
- **Formatting (Biome)**: 2-space indent, 80 char width, LF, ES5 trailing commas, semicolons always, double quotes for JSX/HTML
- **Naming**: `PascalCase.vue` (components), `kebab-case.ts` (composables: `use*.ts`), `camelCase.ts` (stores/services/utils), `UPPER_SNAKE_CASE` (constants)
- **Security**: Never log plaintext passwords, mask with `- - - - - `, clear clipboard after timeout, use GPG agent, validate all inputs

---

## Key Commands

```bash
pnpm dev              # Parallel: frontend + NeutralinoJS
pnpm typecheck        # Vue-TSC type checking (MUST pass before changes)
pnpm format           # Biome lint + format (MUST pass before changes)
pnpm build            # Full build (frontend + NeutralinoJS)
pnpm release          # Release build
```

---

## TODO.md Checklist Summary

From `TODO.md` at repo root:

- ✅ Pass binary resolution, version check, path validation
- ✅ GPG binary detection, version parsing, secret key listing
- ✅ Store path resolution ($PASSWORD_STORE_DIR / ~/.password-store)
- ✅ Config file read/write, Zod schema validation, TOML comment preservation
- ✅ Command injection prevention, path traversal prevention
- ✅ Readiness state machine (10 states: NEED_PASS, NEED_TREE, NEED_GPG, GPG_NO_KEYS, STORE_NOT_FOUND, STORE_NO_GPG_ID, STORE_GPG_ID_EMPTY, STORE_GPG_ID_KEY_MISSING, STORE_EMPTY, READY)
- ✅ Store validation (.gpg-id parsing, recipient verification, behavioral check)
- ✅ Centralized readiness orchestrator (ReadinessService.check())
- ❌ Entry listing, detail retrieval, mutations, clipboard
- ❌ All Pinia stores (readiness, entries, selected entry, clipboard, store-context)
- ❌ All UI flows (readiness screens, password list, entry detail, onboarding, settings)
- ❌ Security: clipboard clearing, memory clearing, GPG agent handling

Full checklist at `TODO.md` — 168 total items, ~45 checked, ~123 pending.

---

## Key Architecture Constraints

1. **Services call NeutralinoJS, not components.** Components never call Neutralino directly.
2. **All errors use `Result<T, E>`.** No throwing for expected failures.
3. **Backend-first.** Readiness -> entry ops -> state contracts -> UI. Never skip layers.
4. **Password stores are valid only in**: `$PASSWORD_STORE_DIR` (if set) or `$HOME/.password-store`. Do not search arbitrary paths.
5. **Neutralino is already initialized in `main.ts`.** Do not reinitialize.
6. **Multi-store from day one.** Config already supports `stores: Record<string, StoreConfig>`.
7. **Config is a product surface.** Keep it validated, user-readable, with comment-preserving TOML round-trips.
