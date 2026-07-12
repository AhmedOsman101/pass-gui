# pass-gui

A **desktop GUI for GNU Pass** (the standard Unix password manager). Wraps `pass` and GPG under a graphical interface using NeutralinoJS (a lightweight alternative to Electron). Manages multiple password stores, validates environment readiness, lists entries, provides clipboard-backed copy operations, and supports full CRUD on password entries.

## Tech Stack

| Layer            | Technology                                       |
| ---------------- | ------------------------------------------------ |
| Frontend         | Vue 3.5 + Pinia 3 + TypeScript 5.9               |
| Styling          | TailwindCSS v4 + tw-animate-css + shadcn-vue 2   |
| Desktop Runtime  | NeutralinoJS 6.8 (native API without Electron)   |
| Build Tool       | Vite 8 + vite-plugin-neutralino                  |
| Linter/Formatter | Biome 2.5 (no ESLint/Prettier)                   |
| Error Handling   | lib-result 5 (typed `Result<T, E>`, never throw) |
| Validation       | Zod 4                                            |
| Config Format    | TOML via `@ltd/j-toml` (comment-preserving)      |
| Icons            | Lucide Vue + Radix Icons (via iconify)           |
| Testing          | Vitest + Vue Test Utils + @pinia/testing         |
| Package Manager  | pnpm 11.9 (workspace: root + client/)            |

## Features

### Backend (complete)

- **Environment readiness** — 10-state machine checks `pass`, GPG keys, store structure, and recipient validity before unlocking the UI
- **Config system** — TOML with Zod validation, comment preservation, cross-field validation (active_store references valid store)
- **Store validation** — `.gpg-id` parsing (comment stripping, fingerprint detection), recipient verification (exact + short ID suffix match), behavioral check (`pass ls`)
- **Entry CRUD** — list (filesystem-based via store-walker), show (structured `pass show` parsing), insert, generate (memorable + standard), remove, copy/duplicate, move, edit (show->reinsert)
- **Clipboard** — writeText/clear with config-backed timeout, drift-corrected countdown timer
- **Password generation** — CSPRNG via `crypto.getRandomValues`, memorable (EFF Short Wordlist #1+#2, 2448 words) or standard random from charset
- **Shell security** — POSIX/Windows quoting, argument validation, directory traversal prevention
- **Multi-store** — config supports `stores: Record<string, StoreConfig>` from day one

### Frontend (Phase 4 — 6/7 quests complete)

- **Readiness-driven app entry** — ReadinessGate -> LoadingScreen / BlockedScreen (IssueCard with recovery guidance) / ready slot
- **Resizable two-panel layout** — sidebar (AppSidebar) + entry detail (EntryDetail)
- **Entry tree** — recursive filesystem tree with debounced search, sort (alpha/recent/type), context menus, arrow nav, TransitionGroup animation
- **Entry detail** — secret show/hide/copy, metadata display with friendly labels, notes section, action bar (duplicate/edit/rename/move/delete)
- **Entry form** — create/edit with path, password with inline generator, metadata editor with duplicate key validation
- **All CRUD dialogs** — Insert, Generate, Rename, Delete, Duplicate, Move, CreateFolder
- **Password generator dialog** — standalone with memorable toggle, length slider, symbols toggle
- **Clipboard toast** — fixed-position with countdown and clear-now button
- **Theme toggle** — dark/light/system mode via `@vueuse/core` `useColorMode`
- **Settings UI** — tabs for general preferences, password generation, clipboard, GPG info, extensions, store management, and store creation wizard
- **shadcn-vue components** — sidebar, button, input, separator, skeleton, tooltip, breadcrumb, sheet, collapsible, dropdown-menu, context-menu, alert-dialog, resizable, dialog, sonner

## Prerequisites

- **[GNU Pass](https://www.passwordstore.org/)** (`pass`) — the standard Unix password manager
- **[GnuPG](https://gnupg.org/)** (`gpg`) — for encryption/decryption
- **GPG key pair** — at least one secret key in your keyring
- **Node.js 24+** and **pnpm 11.9+**
- **[Neu CLI](https://neutralino.js.org/docs/cli/neu-cli)** (optional, for native builds):
  ```bash
  npm install -g @neutralinojs/neu
  ```

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd pass-gui

# Install dependencies
pnpm install

# Update NeutralinoJS binaries
neu update

# Start development (frontend + NeutralinoJS in parallel)
pnpm dev

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

## Build

```bash
# Production build (frontend + NeutralinoJS)
pnpm build

# Release build (clean + production)
pnpm release
```

Output is generated in the `build/` directory.

## Test

```bash
# Run all unit tests (currently 211 tests, 11 files)
pnpm test

# With coverage
pnpm test:coverage

# Integration tests (requires Podman/Docker)
podman build -t pass-gui-test -f Containerfile.test .
```

## Project Structure

```
pass-gui/
├── client/
│   ├── src/
│   │   ├── main.ts              # Entry: mounts Vue, inits Neutralino + services
│   │   ├── App.vue              # Root: ReadinessGate -> RouterView
│   │   ├── router/index.ts      # Vue Router (file-based auto-routes from pages/)
│   │   ├── types/               # TypeScript types: config, entries, readiness, toml
│   │   ├── lib/                 # Pure utility functions (no Neutralino deps)
│   │   │   ├── errors.ts        # 14 error classes + error code maps
│   │   │   ├── shell.ts         # Shell quoting, path traversal prevention
│   │   │   ├── toml.ts          # TOML parse/stringify with comment preservation
│   │   │   ├── store-walker.ts  # Filesystem-based entry listing
│   │   │   ├── parse-pass-show.ts  # Structured pass show output parsing
│   │   │   ├── generate-password.ts  # CSPRNG password generation
│   │   │   └── tree-*.ts        # Tree indexing and state utilities
│   │   ├── services/            # Backend services (singletons, all through Neutralino)
│   │   │   ├── neutralino.ts    # Command exec, binary resolution, env vars
│   │   │   ├── filesystem.ts    # mkdir/exists/readFile/writeFile/tree building
│   │   │   ├── config.ts        # TOML config load/save/ensure
│   │   │   ├── pass.ts          # pass binary validation, scoped exec
│   │   │   ├── gpg.ts           # gpg detection, secret key listing
│   │   │   ├── store.ts         # Store resolution from config
│   │   │   ├── store-validation.ts  # .gpg-id parsing, recipient verification
│   │   │   ├── readiness.ts     # Orchestrator: check() -> ReadinessSnapshot
│   │   │   ├── entries.ts       # Full CRUD via pass commands
│   │   │   ├── clipboard.ts     # Clipboard read/write/clear
│   │   │   └── watcher.ts       # Filesystem change watcher
│   │   ├── stores/              # Pinia stores
│   │   │   ├── readiness.ts     # ReadinessSnapshot, evaluate/reset
│   │   │   ├── active-store.ts  # Current store path/name management
│   │   │   ├── entry-tree.ts    # Tree/CRUD/selection state (401 lines)
│   │   │   ├── entry-form.ts    # Create/edit form state
│   │   │   └── clipboard.ts     # Clipboard timer and state
│   │   ├── composables/         # Vue composables
│   │   │   ├── useTreeState.ts
│   │   │   ├── use-password-generator.ts
│   │   │   ├── use-clipboard-buffer.ts
│   │   │   └── use-generation-config.ts
│   │   ├── pages/               # File-based routing pages
│   │   │   ├── index.vue        # Main layout: sidebar + entry detail
│   │   │   ├── settings.vue     # Settings tabs
│   │   │   └── test.vue         # Dev test page
│   │   └── components/          # Vue components
│   │       ├── readiness/       # ReadinessGate, BlockedScreen, IssueCard, LoadingScreen
│   │       ├── settings/        # AddStoreWizard, ClipboardTab, GenerationTab, etc.
│   │       ├── AppSidebar.vue, Tree.vue, EntryDetail.vue, EntryForm.vue
│   │       ├── PasswordGenerator.vue, ModeToggle.vue
│   │       └── dialogs/         # Insert, Generate, Rename, Delete, Duplicate, Move, CreateFolder
│   ├── vitest.config.ts         # Vitest config (separate from vite.config.ts)
│   └── vite.config.ts           # Vite config
├── docs/                        # Roadmap, specs, plans, references
│   ├── roadmap/                 # Strategic direction (read first, in order)
│   ├── specs/                   # Atomic specification per phase
│   └── plans/                   # Execution plans per phase
├── tests/integration/           # Integration tests (Podman/Docker)
├── Containerfile.test           # Integration test container image
├── neutralino.config.json       # NeutralinoJS app configuration
├── biome.json                   # Biome linter/formatter config
├── pnpm-workspace.yaml          # pnpm workspace config
└── TODO.md                      # Full implementation checklist
```

## Architecture

### Layering

```
config -> readiness -> entry operations -> state contracts (stores) -> UI
```

### Services layer (all singletons)

| Service           | Purpose                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `Neu`             | Command execution, binary resolution, env vars, existence checks                   |
| `Fs`              | mkdir, exists, readFile, writeFile, readDirectory (flat+tree), gitignore filtering |
| `Config`          | load/save/ensure, generic getValue/setValue, platform-aware paths                  |
| `Pass`            | Binary validation, version check, scoped exec with PASSWORD_STORE_DIR              |
| `Gpg`             | gpg2/gpg detection, version parsing, secret key listing                            |
| `Store`           | get/set/validatePath for stores from config                                        |
| `StoreValidation` | .gpg-id parsing, recipient verification, behavioral check                          |
| `Readiness`       | Orchestrator: check(storePath) -> ReadinessSnapshot                                |
| `Entries`         | list/show/insert/generate/remove/copy/move/edit                                    |
| `Clipboard`       | readText/writeText/clear via NeutralinoJS native API                               |

### Key constraints

1. Services call NeutralinoJS, components call services (never Neutralino directly)
2. All errors use `Result<T, E>` — no throwing for expected failures
3. Init flow: `Neutralino.init()` -> `neuInitialized` -> `gpgInitialized` -> `passInitialized`
4. App mount via `ReadinessGate` which blocks until readiness evaluation completes

## Development Commands

```bash
pnpm dev              # Parallel: frontend + NeutralinoJS
pnpm dev:frontend     # Vite dev server only
pnpm dev:neutralino   # With inspector
pnpm typecheck        # vue-tsc type checking
pnpm lint             # Biome check
pnpm format           # Biome auto-fix (safe only)
pnpm format:unsafe    # Biome auto-fix (including unsafe)
pnpm build            # Full build (frontend + NeutralinoJS)
pnpm release          # Release build
pnpm test             # Vitest unit tests
pnpm test:coverage    # With coverage report
```

## License

GNU General Public License v3.0 or later. See `LICENSE`.
