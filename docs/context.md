# pass-gui Context File

> Last updated: July 12, 2026

---

## What is pass-gui

A **desktop GUI for GNU Pass** (the standard Unix password manager). It wraps `pass` and GPG under a graphical interface using NeutralinoJS (a lightweight alternative to Electron). It manages multiple password stores, validates environment readiness, lists entries, provides clipboard-backed copy operations, and supports full CRUD on password entries.

**Tech stack**: Vue 3.5 + Pinia 3 + NeutralinoJS 6.4 + TypeScript 5.9 + TailwindCSS v4 + shadcn-vue 2 + lib-result 5 + Zod 4 + `@ltd/j-toml` + Biome 2.5

---

## Project Structure

```
pass-gui/
├── AGENTS.md                    # Agent guidelines (code style, architecture, commands)
├── TODO.md                      # Authoritative checklist of remaining work
├── biome.json                   # Biome linter/formatter (sole lint tool, no ESLint)
├── neutralino.config.json       # NeutralinoJS app config
├── docs/
│   ├── code-reviews/            # Execution plans per phase
│   ├── external-resources/      # API docs and source code for various useful things
│   ├── plans/                   # Execution plans per phase
│   ├── roadmap/                 # Strategic roadmap
│   └── specs/                   # Stable scoping specs per phase
└── client/src/
    ├── main.ts                  # Entry point: mounts Vue, inits services
    ├── App.vue                  # Root: ReadinessGate -> loading/blocked/ready
    ├── router.ts                # Vue Router (file-based routing from pages/)
    ├── types/
    │   ├── index.ts             # Brand, Version, SecretKey, ALLOWED_COMMANDS
    │   ├── config.ts            # AppConfig, CoreConfig, StoreConfig, etc.
    │   ├── toml.ts              # TomlObject, ParsedToml, etc.
    │   ├── readiness.ts         # ReadinessState (10-state union), ReadinessIssue
    │   └── entries.ts           # EntryNode, EntryTree, EntryDetail, MutationInput
    ├── lib/
    │   ├── errors.ts            # 14 error classes, error code maps (439L)
    │   ├── constants.ts         # PASS_MIN_VERSION, GPG_MIN_VERSION, DEFAULT_CONFIG
    │   ├── utils.ts             # cn(), compareVersions(), brand(), stripInlineComment()
    │   ├── path.ts              # expandTilde(), resolveUserPath(), getHomeDir()
    │   ├── shell.ts             # Shell quoting, argument validation, path traversal prevention
    │   ├── toml.ts              # TOML parse/stringify with comment preservation (270L)
    │   ├── store-walker.ts      # Filesystem-based entry listing (replaces pass ls parsing)
    │   ├── parse-pass-show.ts   # Structured parsing of `pass show` output
    │   ├── readiness-helper.ts  # SEVERITY map, issue() factory
    │   ├── generate-password.ts # CSPRNG password generation (memorable + standard)
    │   └── wordlist.ts          # EFF Short Wordlists #1+#2 (2448 words)
    ├── services/
    │   ├── neutralino.ts        # Neu singleton: exec/safeExec/getEnv/commandExists (242L)
    │   ├── filesystem.ts        # Fs class: mkdir/exists/readFile/writeFile/readDirectory (397L)
    │   ├── config.ts            # Config class: load/save/ensure/getValue/setValue (255L)
    │   ├── config-validation.ts # Zod schemas + cross-field validation (225L)
    │   ├── pass.ts              # Pass singleton: init/exec/checkVersion/validatePassBinary (198L)
    │   ├── gpg.ts               # Gpg singleton: gpg2/gpg detection, secret key listing (300L)
    │   ├── store.ts             # Store class: get/set/validatePath (40L)
    │   ├── store-validation.ts  # StoreValidation: parseGpgId/verifyRecipients/validateBehavior (147L)
    │   ├── readiness.ts         # Readiness orchestrator: check() -> ReadinessSnapshot (315L)
    │   ├── entries.ts           # Entries class: list/show/insert/generate/remove/copy/move/edit (252L)
    │   └── clipboard.ts         # Clipboard class: readText/writeText/clear (80L)
    ├── stores/
    │   ├── readiness.ts         # snapshot/isEvaluating/error, evaluate/reset (69L)
    │   ├── active-store.ts      # storePath/storeName/isValidating, load/switchTo/getGpgHome (126L)
    │   ├── entries.ts           # Full CRUD: tree/search/sort/form state (401L)
    │   └── clipboard.ts         # lastAction/remainingMs/timerId, copy/clear/timer (104L)
    ├── composables/
    │   └── use-generation-config.ts  # Loads generation config from disk (26L)
    ├── pages/
    │   ├── index.vue            # Main layout: ResizablePanelGroup (AppSidebar + EntryDetail)
    │   ├── about.vue            # Static stub
    │   └── test.vue             # Dev test page
    └── components/
        ├── AppSidebar.vue       # Main sidebar: search/tree/new/generate/sort/hotkeys (213L)
        ├── Tree.vue             # Recursive file tree with context menus (258L)
        ├── EntryDetail.vue      # Entry detail: secret show/hide/copy, metadata, actions (241L)
        ├── EntryForm.vue        # Create/edit entry with inline password generator (415L)
        ├── PasswordGenerator.vue # Standalone password generator dialog (194L)
        ├── ClipboardToast.vue   # Fixed toast: "Password copied. Clears in Xs" (42L)
        ├── DeleteConfirmDialog.vue  # AlertDialog for entry deletion (61L)
        ├── RenameEntryDialog.vue    # Rename dialog via pass mv (141L)
        ├── DuplicateEntryDialog.vue # Duplicate with folder picker (223L)
        ├── MoveEntryDialog.vue      # Move with folder picker (227L)
        ├── CreateFolderDialog.vue   # Create new folders (102L)
        ├── GenerateDialog.vue       # Generate-and-save dialog (234L)
        ├── InsertDialog.vue         # Simple insert dialog (148L)
        ├── ModeToggle.vue           # Dark/light/system theme toggle (36L)
        ├── ReadinessGate.vue        # App entry: load->evaluate->loading/blocked/ready (44L)
        ├── BlockedScreen.vue        # Shows blocking issue + retry (51L)
        ├── IssueCard.vue            # Maps 14 issue codes to guidance (126L)
        ├── LoadingScreen.vue        # Skeleton loading screen (13L)
        └── ui/                      # shadcn-vue components
```

---

## Architecture

### Layering

```
config -> readiness -> entry operations -> state contracts -> UI
```

Each layer depends on the one before it. **All backend layers are complete.** The app is in the UI layer (Phase 04).

### Services Layer

All singletons, all in `client/src/services/`:

| Service           | File                  | Lines | Purpose                                                                                 |
| ----------------- | --------------------- | ----- | --------------------------------------------------------------------------------------- |
| `Neu`             | `neutralino.ts`       | 242   | Command exec, binary resolution, env vars, command existence checking                   |
| `Fs`              | `filesystem.ts`       | 397   | mkdir, exists, readFile, writeFile, readDirectory (flat+tree), buildTree, ignore filter |
| `Config`          | `config.ts`           | 255   | load/save/ensure, generic getValue/setValue, platform-aware paths                       |
| `Pass`            | `pass.ts`             | 198   | Binary validation, version check, scoped exec with PASSWORD_STORE_DIR                   |
| `Gpg`             | `gpg.ts`              | 300   | gpg2/gpg detection, version parsing, secret key listing with colon-parsed output        |
| `Store`           | `store.ts`            | 40    | get/set/validatePath for stores from config                                             |
| `StoreValidation` | `store-validation.ts` | 147   | .gpg-id parsing, recipient verification, behavioral check, hasEntries                   |
| `Readiness`       | `readiness.ts`        | 315   | check(storePath) -> ReadinessSnapshot, sequential dependency checks                     |
| `Entries`         | `entries.ts`          | 252   | list/show/insert/generate/remove/copy/move/edit with mapPassError                       |
| `Clipboard`       | `clipboard.ts`        | 80    | readText/writeText/clear via NeutralinoJS native API                                    |

### Init Flow (main.ts)

```ts
// main.ts — current architecture
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app"); // Mounts BEFORE service init

Neutralino.init();
await neuInitialized; // Resolves home directory
await gpgInitialized; // Detects GPG binary, reads GNUPGHOME
await passInitialized; // Reads PASSWORD_STORE_DIR, checks .gpg-id
```

**App.vue flow**:

1. `ReadinessGate` mounts
2. On mount: `activeStore.load()` -> `readiness.evaluate(storePath)`
3. While loading: `LoadingScreen` (skeleton)
4. If blocked: `BlockedScreen` (issue cards + retry)
5. If ready: `<slot>` (renders `RouterView` + `ClipboardToast`)

**Known issue**: Module-level init promises still block before `ReadinessGate` can run. If any service init fails, the app never renders past the initial shell.

### Pinia Stores

| Store          | File              | Lines | State                                                  | Key Actions                                                       |
| -------------- | ----------------- | ----- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| `readiness`    | `readiness.ts`    | 69    | snapshot, isEvaluating, error                          | evaluate(storePath), reset()                                      |
| `active-store` | `active-store.ts` | 126   | storePath, storeName, isValidating, error              | load(), switchTo(name), getGpgHome()                              |
| `entries`      | `entries.ts`      | 401   | tree, currentPath, currentEntry, searchQuery, formMode | loadTree, selectEntry, insert/generate/remove/move/duplicate/edit |
| `clipboard`    | `clipboard.ts`    | 104   | lastAction, remainingMs, timerId, isCopied             | copy(secret, path), clear(), startTimer, stopTimer                |

All stores are setup stores (function form), return `Result` types from actions, and consume service contracts.

### Error Handling

**Mandatory**: `Result<T, E>` from `lib-result` for everything that can fail. Never throw for expected failures.

Error classes in `client/src/lib/errors.ts` (14 total):

- `NeuError` (base) + `DirectoryCreationError`, `FileWriteError`
- `ConfigNotFoundError`, `ConfigParseError`, `ConfigWriteError`, `ConfigValidationError`
- `StoreValidationError`
- `CommandFailedError` — `{ cmd, args, exitCode, stdOut, stdErr, pid }`
- `EntryNotFoundError`, `EntryAlreadyExistsError`, `EntryParseError`, `ClipboardError`, `MutationError`

Error code maps: `NEU_ERROR_CODES` (40+), `CONFIG_ERROR_CODES` (4), `STORE_ERROR_CODES` (7), `ENTRY_ERROR_CODES` (5).

---

## Current State: What is IMPLEMENTED

### Backend

- **Config system** — load/save/ensure/getValue/setValue with Zod validation, TOML comment preservation via `@ltd/j-toml`, cross-field validation (active_store references valid store), commented default config on first write
- **Readiness orchestrator** — Sequential checks: pass -> tree -> gpg -> gpgKeys -> store -> storeEmpty. Returns `ReadinessSnapshot` with state + issues.
- **Store validation** — .gpg-id parsing (comment stripping, fingerprint detection), recipient verification (fingerprint exact + short ID suffix match), behavioral check (`pass ls`), hasEntries check
- **Entry operations** — All CRUD: list (filesystem-based via store-walker), show (pass show parsing), insert (pass insert -m -f), generate (pass generate + memorable), remove (pass rm -rf), copy (show->insert), move (pass mv), edit (show->insert with force)
- **Clipboard service** — writeText/clear with config-backed timeout, drift-corrected timer
- **Shell security** — POSIX/Windows quoting, argument validation, directory traversal detection (`../`, null bytes)
- **NeutralinoService** — Command execution with ANSI stripping, binary resolution with symlink following, env var access, command existence checking
- **Filesystem service** — Full directory operations including tree building and gitignore-style filtering
- **Password generation** — CSPRNG via `crypto.getRandomValues`, memorable format (NNNN-word-word-word), standard random from charset

### Frontend

- **Readiness-driven app entry** — ReadinessGate -> LoadingScreen/BlockedScreen/ready slot
- **App shell** — Resizable two-panel layout (AppSidebar + EntryDetail)
- **Sidebar** — Search, recursive tree, context menus (copy/move/rename/delete/new folder), sort dropdown, global hotkeys (Ctrl+C/X/V, F2, Delete)
- **Entry detail** — Secret field with show/hide/copy, metadata display with friendly labels, notes section, action bar (duplicate/edit/rename/move/delete)
- **Entry form** — Create/edit with path, password with inline generator (memorable/length/symbols), metadata editor with duplicate key validation
- **Password generator** — Standalone dialog with memorable toggle, length slider, symbols toggle
- **All CRUD dialogs** — Delete, Rename, Duplicate, Move, CreateFolder, Generate, Insert
- **Clipboard toast** — Fixed-position toast with countdown and clear-now button
- **Theme toggle** — Dark/light/system mode via `@vueuse/core` useColorMode
- **shadcn-vue suite** — sidebar, button, input, separator, skeleton, tooltip, breadcrumb, sheet, collapsible, dropdown-menu, context-menu, alert-dialog, resizable

---

## Current State: What is NOT IMPLEMENTED

Full checklist at `TODO.md` — ~55 checked, ~115 pending.

### Testing

| Priority | Layer                 | Test files                                                                                                                                | Tests | Status |
| -------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| P0       | Pure lib              | `parse-pass-show`, `generate-password`, `tree-index`, `tree-state`, `path`                                                                | 69    | ✅     |
| P1       | Shell/Path services   | `neutralino`, `filesystem`, `gpg`, `pass`, `clipboard`                                                                                    | 152   | ✅     |
| P2       | Service orchestration | `entries`, `readiness`, `watcher`, `dialog`                                                                                               | 77    | ✅     |
| P3       | Stores + composables  | entry-form, readiness, clipboard, active-store, entry-tree, useGenerationConfig, usePasswordGenerator, useClipboardBuffer, useTreeState   | 123   | ✅     |
| P4       | Core services         | `config`, `config-validation`, `store-validation`                                                                                         | 77    | ✅     |
| P5       | Components            | EntryForm, Tree, AppSidebar, AddStoreWizard, GpgTab, StoresTab, EntryDetail, CreateFolderDialog, RenameEntryDialog, MoveOrDuplicateDialog | 96    | ✅     |
| P6       | Integration           | Podman container suite (Future work)                                                                                                      | —     | ⬜     |

**Running total:** 583 tests, 37 files, 7.56s execution.
**Mock strategy:** `vi.mock("@neutralinojs/lib")` in `setup.ts` provides global mocks. Test-specific overrides via `vi.mocked()`. Results from `lib-result` (`Ok()` / `ErrFromText()`), never duck-typed.
**Key config:** biome.json disables `noNonNullAssertion` for `*.test.ts` (safe for `result.ok!` after `.isOk()`). Vitest config in `vitest.config.ts` with happy-dom environment.

---

## Key Commands

```bash
mask dev              # Parallel: frontend + NeutralinoJS
mask dev neutralino   # With inspector
mask dev frontend     # Vite dev server only
mask typecheck        # Vue-TSC type checking (MUST pass before changes)
mask lint             # Biome check
mask format           # Biome auto-fix (safe only)
mask format --unsafe  # Biome auto-fix (including unsafe)
mask build            # Full build (frontend + NeutralinoJS)
mask build frontend   # Vite build only
mask release          # Release build
```

---

## Key Architecture Constraints

1. **Services call NeutralinoJS, not components.** Components never call Neutralino directly.
2. **All errors use `Result<T, E>`.** No throwing for expected failures.
3. **Backend-first.** Readiness -> entry ops -> state contracts -> UI. Never skip layers.
4. **Password stores are valid only in**: `$PASSWORD_STORE_DIR` (if set) or `$HOME/.password-store`. Do not search arbitrary paths.
5. **Neutralino is already initialized in `main.ts`.** Do not reinitialize.
6. **Multi-store from day one.** Config already supports `stores: Record<string, StoreConfig>`.
7. **Config is a product surface.** Keep it validated, user-readable, with comment-preserving TOML round-trips.
8. **Stores consume services, never invent backend behavior.** All store actions delegate to the services layer.

---

## Known Issues

1. **Module-level init promises** — `neuInitialized`, `gpgInitialized`, `passInitialized` block app mount. If any fails, app never renders. Phase 05 should fix with graceful degradation.
2. **TOML comment preservation** — Full-line comments may be lost on modify. Inline comments after key/value pairs are preserved.
3. **Biome LSP may panic** — On sudden file changes, Biome LSP may emit false-positive errors. Restart LSP if this occurs.
4. **NeutralinoJS clipboard limitation** — `writeText` always reports success even if clipboard is locked. Only JS-side argument validation errors are caught.
