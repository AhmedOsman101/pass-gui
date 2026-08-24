# pass-gui Context File

> Last updated: August 24, 2026. Glossary lives in root `CONTEXT.md`.

---

## What is pass-gui

A **desktop GUI for GNU Pass** (the standard Unix password manager). It wraps `pass` and GPG under a graphical interface using NeutralinoJS (a lightweight alternative to Electron). It manages multiple password stores, validates environment readiness, lists entries, provides clipboard-backed copy operations, and supports full CRUD on password entries.

**Tech stack**: Vue 3.5 + Pinia 3 + NeutralinoJS 6.4 + TypeScript 5.9 + TailwindCSS v4 + shadcn-vue 2 + lib-result + Zod 4 + `@ltd/j-toml` + Biome

---

## Project Structure

```
pass-gui/
├── AGENTS.md                    # Agent guidelines (mask runner, external resources)
├── CONTEXT.md                   # Ubiquitous language (glossary only)
├── TODO.md                      # Thin pointer: current epics + open gaps
├── biome.json                   # Biome linter/formatter (sole lint tool, no ESLint)
├── neutralino.config.json       # NeutralinoJS app config
├── docs/
│   ├── agents/                  # Skill conventions: issue tracker, labels, domain docs
│   ├── adr/                     # (created lazily on first ADR)
│   ├── context.md               # This file
│   ├── external-resources/      # Vendored third-party docs+source (GITIGNORED)
│   ├── grilling/                # Decision logs (Q&A) per feature
│   ├── plans/                   # Execution plans (+ tickets staged in .scratch/)
│   └── specs/                   # Stable scoping specs per feature
└── client/src/
    ├── main.ts                  # Entry point: mounts Vue, inits services
    ├── App.vue                  # Root: ReadinessGate -> loading/blocked/ready
    ├── router/                  # Vue Router setup
    ├── types/                   # index, config, readiness, entries, toml
    ├── lib/                     # errors, constants (DEFAULT_CONFIG, min versions),
    │                            # utils, path, shell, toml, store-walker,
    │                            # parse-pass-show, readiness-helper,
    │                            # generate-password, wordlist
    ├── services/                # Neu, Fs, Config, Pass, Gpg, Store, StoreValidation,
    │                            # Readiness, Entries, Clipboard, Watcher, Dialog
    ├── stores/                  # readiness, active-store, entry-tree, entry-form, clipboard
    ├── composables/             # use-async-action, use-notify-result, use-generation-config,
    │                            # use-password-generator, use-tree-state
    ├── pages/                   # index (main layout), settings (tabbed), test (dev)
    └── components/
        ├── AppSidebar.vue       # Sidebar: search/tree/new/generate/sort/hotkeys
        ├── Tree.vue             # Recursive entry tree with context menus
        ├── EntryDetail.vue      # Secret show/hide/copy, metadata, actions
        ├── EntryForm.vue        # Create/edit with inline generator
        ├── readiness/           # ReadinessGate, BlockedScreen, IssueCard, LoadingScreen
        ├── settings/            # StoresTab, AddStoreWizard, GpgTab, GenerationTab,
        │                        # ClipboardTab, ExtensionsTab, InfoTab
        └── ui/                  # shadcn-vue suite
```

---

## Architecture

### Layering

```
config -> readiness -> entry operations -> state contracts -> UI
```

Each layer depends only on the ones before it.

### Services Layer

All singletons, all in `client/src/services/`:

| Service           | Purpose                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `Neu`             | Command exec/safeExec, binary resolution, env vars, command existence                 |
| `Fs`              | mkdir/exists/read/write, directory trees, ignore filtering, watchers helpers          |
| `Config`          | load/save/ensure/getValue/setValue, platform paths, TOML round-trip with comments     |
| `Pass`            | Binary validation, version check, scoped exec (`PASSWORD_STORE_DIR`)                  |
| `Gpg`             | gpg2/gpg detection, version parsing, secret-key listing, optional GNUPGHOME           |
| `Store`           | Store lookup + creation recipes (mkdir -> scoped `pass init` -> config write)         |
| `StoreValidation` | `.gpg-id` parsing, recipient verification, behavioral check, hasEntries               |
| `Readiness`       | `check(storePath)` -> `ReadinessSnapshot`; sequential dependency checks               |
| `Entries`         | list/show/insert/generate/remove/copy/move/edit with error mapping                    |
| `Clipboard`       | readText/writeText/clear via Neutralino native API                                    |
| `Watcher`         | OS-native file watchers (config + store dirs) driving cache invalidation              |
| `Dialog`          | Native file/message dialogs                                                           |

### Init Flow (main.ts)

```ts
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app"); // Mounts BEFORE service init

Neutralino.init();
await neuInitialized; // Resolves home directory
await gpgInitialized; // Detects GPG binary, reads GNUPGHOME
await passInitialized; // Reads PASSWORD_STORE_DIR, checks .gpg-id
```

**App flow**: `ReadinessGate` mounts -> `activeStore.load()` -> `readiness.evaluate(storePath)` -> LoadingScreen / BlockedScreen / ready slot.

**Known issue**: module-level init promises block before `ReadinessGate` renders. If any service init fails hard, the app never renders past the initial shell. The onboarding overhaul (see TODO) fixes this with lazy/failable init.

### Readiness State Machine

11 states (`types/readiness.ts`): `NEED_PASS`, `NEED_TREE`, `NEED_GPG`, `GPG_NO_KEYS`, `STORE_NOT_FOUND`, `STORE_NO_GPG_ID`, `STORE_GPG_ID_EMPTY`, `STORE_GPG_ID_KEY_MISSING`, `STORE_SCAN_FAILED`, `STORE_EMPTY`, `READY`.

Check order: pass (+version) -> tree (skipped on Windows) -> gpg -> secret keys -> store chain (exists -> isDir -> `.gpg-id` -> parse -> recipients -> behavioral `pass ls`) -> empty-store info check. First blocking issue wins; issues accumulate.

### Error Handling

**Mandatory**: `Result<T, E>` from `lib-result` for everything that can fail. Never throw for expected failures. Error classes + code maps live in `client/src/lib/errors.ts`. Components consume errors through `useAsyncAction` + `useNotifyResult` and `.match()` chains.

---

## Current State: Implemented

### Backend

- **Config system** — load/save/ensure/getValue/setValue, Zod schema + cross-field validation, commented default config on first write (`DEFAULT_CONFIG` ships a placeholder `default` store at `~/.password-store`)
- **Readiness orchestrator** — full sequential chain producing `ReadinessSnapshot`
- **Store validation** — structural, cryptographic (fingerprint exact + short-ID suffix), behavioral
- **Store recipes** — `Store.create()` / add-store flow with internal rollback
- **Entry operations** — filesystem-based listing, show parsing, insert/generate/remove/copy/move/edit
- **Clipboard** — writeText/clear with config-backed timeout, drift-corrected timer
- **Shell security** — quoting, argument validation, traversal detection, command allowlist
- **Result migration** — all services/stores return `Result`; `useAsyncAction`/`useNotifyResult` composables

### Frontend

- Readiness-driven entry (gate -> loading/blocked/ready)
- Main layout: resizable sidebar + entry detail; recursive tree with context menus, search, sort, hotkeys
- Entry form with inline generator (memorable EFF-wordlist + charset modes)
- All CRUD dialogs; clipboard toast with countdown; dark/light/system theme
- Settings page with tabbed sections (stores + add-store wizard, GPG, generation, clipboard, extensions, info)

## Current State: Not Implemented

- **Onboarding overhaul** — replace BlockedScreen dead-end with guided remediation workflow. Spec published as GitHub issue #21 (label `ready-for-agent`).
- **Tests** — intentionally removed (scripts, configs, CI steps, docs traces pruned). No runner exists; do not claim test coverage anywhere.
- Extensions execution (config flag exists, runtime does not)
- Per-session store override; store rename/removal; multi-recipient `.gpg-id` authoring
- Command timeouts; QR export; pass extension support

---

## Key Commands

```bash
mask dev              # Parallel: frontend + NeutralinoJS
mask dev neutralino   # With inspector
mask typecheck        # Vue-TSC type checking (MUST pass before changes)
mask lint             # Biome check
mask format           # Biome auto-fix (safe only)
mask build            # Full build
```

---

## Key Architecture Constraints

1. **Services call NeutralinoJS, not components.** Components never call Neutralino directly.
2. **All errors use `Result<T, E>`.** No throwing for expected failures.
3. **Backend-first.** Readiness -> entry ops -> state contracts -> UI. Never skip layers.
4. **Password stores are valid only in**: `$PASSWORD_STORE_DIR` (if set) or `$HOME/.password-store`. Do not search arbitrary paths.
5. **Neutralino is already initialized in `main.ts`.** Do not reinitialize.
6. **Multi-store from day one.** Config supports `stores: Record<string, StoreConfig>`.
7. **Config is a product surface.** Validated, user-readable, comment-preserving TOML round-trips.
8. **Stores consume services, never invent backend behavior.**

---

## Known Issues

1. **Module-level init promises** block app mount (fix planned in onboarding overhaul, Phase 0).
2. **TOML comment preservation** — full-line comments may be lost on modify; inline comments preserved.
3. **Biome LSP may panic** on sudden file changes — restart LSP if false positives appear.
4. **NeutralinoJS clipboard limitation** — `writeText` reports success even when the clipboard is locked.
