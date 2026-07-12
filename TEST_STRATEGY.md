# Test Strategy: pass-gui

> A single authoritative specification of how to test every layer of pass-gui.
> Written after 6 investigation tickets. A builder agent can pick this up
> and implement tests for every layer from this document alone.

---

## 1. Overview

pass-gui is a desktop GUI wrapper for GNU Pass built with Vue 3.5 + Pinia 3 +
NeutralinoJS 6.4. Three testing layers cover the stack:

| Layer | What | Runner |
|-------|------|--------|
| **Unit** | Pure lib functions, shell/path utilities, services | Vitest (happy-dom) |
| **Component** | Vue SFC behavior via VTU mount | Vitest + Vue Test Utils |
| **Integration** | Real GPG/pass commands inside container | Vitest (Podman/Docker) |

### Priority Order (implement in this sequence)

```
P0  Pure lib functions (parse-pass-show, generate-password, tree-index, tree-state)
P1  Shell/path utilities (neutralino, filesystem, gpg, pass, clipboard, path)
P2  Service orchestration (entries, watcher, readiness, dialog)
P3  Stores + composables (active-store, entry-tree, clipboard, entry-form, readiness, useTreeState, ...)
P4  Core services (config, store-validation)
P5  Components (7 core + 3 lightweight — see §6)
P6  Integration tests (Podman container — see §7)
```

---

## 2. Tech Stack

| Concern | Choice |
|---------|--------|
| Test runner | Vitest v4.1.10 |
| Test environment | happy-dom (lightweight, enough DOM API for VTU) |
| Component testing | Vue Test Utils v2 (`mount()/shallowMount()`) |
| State testing | @pinia/testing v1 (`createTestingPinia`) |
| Mock strategy | `vi.mock()` at module level |
| Coverage | v8 provider (built-in) |
| Assertions | Vitest built-in (`expect`, `vi.fn()`) + optional `@testing-library/vue` |
| Linting | Biome 2.5.0 (linter + formatter) |
| Type checking | vue-tsc 3.2 |
| CI | GitHub Actions |
| Integration | Alpine-based Containerfile.test (Docker in CI, Podman locally) |

### Package manager scripts

```jsonc
// root package.json
"test": "pnpm --filter=client test:unit",
"test:unit": "pnpm --filter=client test:unit",
"test:coverage": "pnpm --filter=client test:coverage",
"test:integration": "echo 'Integration tests: run inside Podman container'"
"lint": "unset BIOME_CONFIG_PATH; biome lint .",
"typecheck": "pnpm --filter=client typecheck"

// client/package.json
"test:unit": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"typecheck": "vue-tsc --build"
```

---

## 3. Mock Strategy

### NeutralinoJS — `vi.mock("@neutralinojs/lib")`

All NeutralinoJS I/O is mocked at the module level. Zero code changes to the
application. The mock is set up globally in `client/src/test/setup.ts` via
a `vi.hoisted()` factory function `createMockNeu()`.

**What's mocked:**

| Namespace | Used functions | Default return |
|-----------|---------------|----------------|
| `init()` | standalone default export | `vi.fn()` — no-op (prevents WebSocket connection) |
| `os` | execCommand, getEnv, getPath, showOpenDialog, showSaveDialog, showFolderDialog, showNotification, showMessageBox | All return `Promise.resolve()` with sensible defaults |
| `filesystem` | createDirectory, writeFile, readFile, getNormalizedPath, getJoinedPath, getPathParts, getRelativePath, readDirectory, getStats, createWatcher, removeWatcher | All return `Promise.resolve()` |
| `clipboard` | readText, writeText, clear | All return `Promise.resolve()` |
| `events` | on, off | `Promise.resolve({ success: true, message: "ok" })` |
| `debug` | log | `Promise.resolve()` |

**Extra namespaces stubbed:** app, computer, storage, resources, server,
updater, custom — all `vi.fn()` to prevent errors if accidentally accessed.

**Enums included for reference:** OperatingSystem, Icon, MessageBoxChoice,
LoggerType, ClipboardFormat.

### Globals that must be mocked separately

These are NOT part of the `@neutralinojs/lib` module — they're set as
globals by the NeutralinoJS runtime:

```ts
// Already in setup.ts:
Object.defineProperty(globalThis, "NL_OS", { value: "Linux" });
Object.defineProperty(globalThis, "NL_HOME_DIR", { value: "/home/user" });
```

### Error shape for rejection tests

NeutralinoJS errors throw `{ code: ErrorCode, message: string }`. The app
catches these as `NeuErrorObj`. Mock rejections must match:

```ts
os.execCommand.mockRejectedValue({
  code: "NE_RT_NATRTER",
  message: "Native method failed",
});
```

### gotchas

1. **`init()` is a side-effect bomb** — WebSocket, event listeners, globals.
   Must be `vi.fn()` in every test config.
2. **`NL_OS` is a global, not from the import** — mock separately.
3. **Namespace structure, not bare functions** — `os.execCommand()`, not
   `execCommand()`. The mock must mirror this exactly.
4. **`filesystem.getJoinedPath`, `getRelativePath` are used without
   `wrapAsync`** — they must resolve to a valid value, not throw.
5. **No DI container** — `vi.mock()` is the only seam. Module-level mocking
   is the correct and only practical approach.

### Services — `vi.mock("@/services/...")`

Stores import services directly. Mock at the service module level:

```ts
vi.mock("@/services/config", () => ({
  Config: {
    getValue: vi.fn(),
    load: vi.fn(),
    setValue: vi.fn(),
  },
}));
```

Services return `Result` types. Use `ok()` / `err()` helper pattern:

```ts
function ok<T>(value: T) {
  return { isError: () => false, ok: value };
}
function err(msg: string) {
  return { isError: () => true, error: { message: msg } };
}
```

---

## 4. Vitest Configuration

**File:** `client/vitest.config.ts` (separate from `vite.config.ts`)

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**"],
      exclude: [
        "src/test/**",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/components/ui/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
```

### Key decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Separate config file | `vitest.config.ts` | Avoids neutralino/vueDevTools plugin conflicts |
| Environment | `happy-dom` | Lighter than jsdom, enough DOM for VTU |
| Globals | `true` | describe/it/expect without imports |
| Plugins | `vue()` only | No vueDevTools, no neutralino in test |
| Pool | `forks` (default) | Isolates vi.mock per worker |
| Setup file | `setup.ts` with `vi.hoisted()` | Factory avoids hoisting issues |

### Run commands

```bash
pnpm test            # Run all unit tests
pnpm test:unit       # Same as above (explicit)
pnpm test:watch      # Watch mode
pnpm test:coverage   # With coverage report
pnpm test:integration # Integration tests (requires container)
```

---

## 5. Test Patterns by Layer

### P0 — Pure lib functions

**Where:** `client/src/lib/`
**Files:** `parse-pass-show.ts`, `generate-password.ts`, `tree-index.ts`, `tree-state.ts`

**Pattern:** Plain unit tests. No mocks needed. Test input → output mapping.

```ts
// client/src/lib/parse-pass-show.test.ts
import { describe, it, expect } from "vitest";
import { parsePassShow } from "./parse-pass-show";

describe("parsePassShow", () => {
  it("parses secret on first line with metadata after", () => {
    const result = parsePassShow("my-secret\nkey1: val1\nkey2: val2\n");
    expect(result.ok?.secret).toBe("my-secret");
    expect(result.ok?.metadata).toEqual({ key1: "val1", key2: "val2" });
  });

  it("returns error on empty output", () => {
    const result = parsePassShow("");
    expect(result.isError()).toBe(true);
  });
});
```

---

### P1 — Shell/path services

**Where:** `client/src/services/`
**Files:** `neutralino.ts`, `filesystem.ts`, `gpg.ts`, `pass.ts`, `clipboard.ts`, `path.ts`

**Pattern:** Mock `@neutralinojs/lib` at module level (already done in setup.ts).
Test each service function with various return values from NeutralinoJS.
Test error paths by making the mock reject.

```ts
// client/src/services/neutralino.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { os } from "@neutralinojs/lib";
import { Neu } from "./neutralino";

describe("Neu.execCommand", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("executes a command and returns the result", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 12345,
      stdOut: "output",
      stdErr: "",
      exitCode: 0,
    });

    const result = await Neu.execCommand("echo test");

    expect(result.isError()).toBe(false);
    expect(result.ok).toEqual({
      pid: 12345,
      stdOut: "output",
      stdErr: "",
      exitCode: 0,
    });
  });

  it("returns error when NeutralinoJS throws", async () => {
    vi.mocked(os.execCommand).mockRejectedValue({
      code: "NE_RT_NATRTER",
      message: "Native method failed",
    });

    const result = await Neu.execCommand("bad command");

    expect(result.isError()).toBe(true);
  });
});
```

---

### P2 — Service orchestration

**Where:** `client/src/services/`
**Files:** `entries.ts`, `watcher.ts`, `readiness.ts`, `dialog.ts`

**Pattern:** Mock lower-level services (Neu, Fs, Pass). Test orchestration
logic — sequencing, error propagation, retry.

---

### P3 — Pinia stores

**Where:** `client/src/stores/`

#### Setup store (ActiveStore — minimal deps, config-driven)

```ts
import { createTestingPinia } from "@pinia/testing";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/config", () => ({
  Config: { getValue: vi.fn(), load: vi.fn(), setValue: vi.fn() },
}));

import { Config } from "@/services/config";
import { useActiveStoreStore } from "@/stores/active-store";

describe("active-store", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.clearAllMocks();
  });

  it("loads active store from config and resolves path", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(ok("work"));
    vi.mocked(Config.load).mockResolvedValue(ok({
      data: { stores: { work: { path: "~/.password-store/work" } } },
    }));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.storeName).toBe("work");
    expect(store.isValidating).toBe(false);
    expect(store.error).toBeNull();
  });
});
```

#### Store with service mocks (EntryTree — CRUD operations)

```ts
import { createTestingPinia } from "@pinia/testing";

vi.mock("@/services/entries", () => ({
  Entries: { list: vi.fn(), show: vi.fn(), insert: vi.fn(), remove: vi.fn(), move: vi.fn(), copy: vi.fn(), edit: vi.fn() },
}));
vi.mock("@/services/filesystem", () => ({
  Fs: { join: vi.fn((...p) => Promise.resolve(p.join("/"))), mkdir: vi.fn() },
}));
vi.mock("@/services/pass", () => ({
  Pass: { storeDirectory: "/home/user/.password-store" },
}));

import { Entries } from "@/services/entries";
import { useEntryTreeStore } from "@/stores/entry-tree";

describe("entry-tree", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.clearAllMocks();
  });

  it("loads tree from Entries.list()", async () => {
    vi.mocked(Entries.list).mockResolvedValue(ok([{ name: "Email", path: "Email", type: "DIRECTORY", children: [] }]));

    const store = useEntryTreeStore();
    await store.loadTree();

    expect(store.tree).toHaveLength(1);
    expect(store.isLoadingTree).toBe(false);
  });

  it("insertEntry calls Entries.insert then refreshes", async () => {
    vi.mocked(Entries.list).mockResolvedValue(ok([]));
    vi.mocked(Entries.insert).mockResolvedValue(ok({ success: true, path: "Email/new-entry" }));
    vi.mocked(Entries.show).mockResolvedValue(ok({ name: "new-entry", path: "Email/new-entry", body: "pass123\n", raw: "pass123\n", fields: {} }));

    const store = useEntryTreeStore();
    const errMsg = await store.insertEntry("Email/new-entry", "pass123\n");

    expect(errMsg).toBeNull();
    expect(Entries.insert).toHaveBeenCalledWith({ path: "Email/new-entry", content: "pass123\n" });
    expect(Entries.list).toHaveBeenCalled();
  });

  it("returns error message on failure", async () => {
    vi.mocked(Entries.insert).mockResolvedValue(err("Entry already exists"));

    const store = useEntryTreeStore();
    const errMsg = await store.insertEntry("Email/existing", "pass\n");

    expect(errMsg).toBe("Entry already exists");
  });
});
```

#### Timer-based store (Clipboard — setTimeout with drift correction)

```ts
import { createTestingPinia } from "@pinia/testing";

vi.mock("@/services/clipboard", () => ({
  Clipboard: { writeText: vi.fn(), clear: vi.fn() },
}));

import { Clipboard } from "@/services/clipboard";
import { useClipboardStore } from "@/stores/clipboard";

describe("clipboard store timer", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => { vi.useRealTimers(); });

  it("decrements remainingMs via drift-correction timer ticks", async () => {
    const now = Date.now();
    const expiresAt = now + 30_000;
    vi.mocked(Clipboard.writeText).mockResolvedValue(ok({ path: "x", selection: "clipboard", timerSeconds: 30, expiresAt }));

    const store = useClipboardStore();
    await store.copy("secret", "x");

    expect(store.remainingMs).toBe(30_000);
    vi.advanceTimersByTime(1_000);
    expect(store.remainingMs).toBe(29_000);
  });

  it("clears clipboard when timer expires and resets state", async () => {
    const now = Date.now();
    vi.mocked(Clipboard.writeText).mockResolvedValue(ok({ path: "x", selection: "clipboard", timerSeconds: 10, expiresAt: now + 10_000 }));
    vi.mocked(Clipboard.clear).mockResolvedValue(ok(undefined));

    const store = useClipboardStore();
    await store.copy("secret", "x");
    vi.advanceTimersByTime(11_000);

    expect(Clipboard.clear).toHaveBeenCalled();
    expect(store.isCopied).toBe(false);
    expect(store.remainingMs).toBe(0);
  });
});
```

#### Pure state store (EntryForm — no services)

No mocking needed. Set refs directly, test getters:

```ts
const store = useEntryFormStore();
store.formMode = "create";
expect(store.isFormOpen).toBe(true);
```

---

### P3 — Composables

**Where:** `client/src/composables/`

#### Composable with store coupling (useTreeState)

```ts
import { createTestingPinia } from "@pinia/testing";
import { useEntryTreeStore } from "@/stores/entry-tree";
import { useTreeState } from "@/composables/useTreeState";

function makeTree() {
  return [
    { name: "Email", path: "Email", type: "DIRECTORY", children: [
      { name: "work", path: "Email/work", type: "FILE", fields: {} },
      { name: "personal", path: "Email/personal", type: "FILE", fields: {} },
    ]},
    { name: "Social", path: "Social", type: "DIRECTORY", children: [
      { name: "twitter", path: "Social/twitter", type: "FILE", fields: {} },
    ]},
  ];
}

describe("useTreeState", () => {
  beforeEach(() => { createTestingPinia({ createSpy: vi.fn }); });

  it("initializes visible nodes from tree store", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const { visibleNodes } = useTreeState();
    expect(visibleNodes.value.length).toBe(2);
  });

  it("toggleDir expands and collapses directory", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const { visibleNodes, toggleDir } = useTreeState();
    toggleDir("Email");
    expect(visibleNodes.value.length).toBe(3);
    toggleDir("Email");
    expect(visibleNodes.value.length).toBe(2);
  });

  it("focusNext cycles forward", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const { focusedPath, focusNext } = useTreeState();
    focusNext();
    expect(focusedPath.value).toBe("Email");
    focusNext();
    expect(focusedPath.value).toBe("Social");
  });
});
```

#### Crypto-dependent composable (usePasswordGenerator)

```ts
vi.mock("@/composables/use-generation-config", () => ({
  useGenerationConfig: () => ({
    options: { memorable: false, length: 20, symbols: true },
  }),
}));

vi.mock("@/lib/generate-password", () => ({
  generatePassword: vi.fn(),
  generateMemorablePassword: vi.fn(),
}));

import { generatePassword } from "@/lib/generate-password";
import { usePasswordGenerator } from "@/composables/use-password-generator";

describe("usePasswordGenerator", () => {
  it("generates password on creation with default options", () => {
    vi.mocked(generatePassword).mockReturnValue("mocked-password-abc123");
    const state = usePasswordGenerator();
    expect(state.generated).toBe("mocked-password-abc123");
    expect(generatePassword).toHaveBeenCalledWith(20, "[[:alnum:]][[:punct:]]");
  });

  it("regenerate re-calls generatePassword", () => {
    vi.mocked(generatePassword).mockReturnValue("first");
    const state = usePasswordGenerator();
    vi.mocked(generatePassword).mockReturnValue("second");
    state.regenerate();
    expect(state.generated).toBe("second");
  });
});
```

### Additional composable patterns

#### Testing Pinia watchers

```ts
it("$subscribe fires on state change", () => {
  createTestingPinia({ createSpy: vi.fn });
  const store = useEntryTreeStore();
  const spy = vi.fn();
  store.$subscribe(spy);
  store.tree = mockTree;
  expect(spy).toHaveBeenCalled();
});

it("$onAction intercepts store actions", () => {
  createTestingPinia({ createSpy: vi.fn });
  const store = useEntryTreeStore();
  const spy = vi.fn();
  store.$onAction(spy);
  store.clearSelection();
  expect(spy).toHaveBeenCalled();
});
```

#### Store with `useRouter`/`useRoute`

```ts
import { createRouter, createMemoryHistory } from "vue-router";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/", component: { template: "<div/>" } }],
});

// Create Pinia instance with router plugin:
// createTestingPinia({ plugins: [routerPlugin] })
```

---

## 6. Component Test Scope

### Which components get tests

#### 7 core — full Vue Test Utils mount with mocked stores/services

| Component | LOC | What to test | Mock strategy |
|-----------|-----|-------------|--------------|
| **EntryForm** | 330 | Form validation, buildContent() format, create vs edit dispatch, error display, password auto-gen, secret visibility | Mock entryTreeStore + entryFormStore via @pinia/testing |
| **Tree** | 271 | Hotkey F2/Delete open dialogs, arrow keys focusNext/focusPrev, isCutDimmed/hasCopyBuffer/isSearchMatch computed, nodeName/dirPath parsers | Mock entryTreeStore + useTreeState via @pinia/testing |
| **AppSidebar** | 247 | Search debounce (300ms), store watcher start/stop lifecycle, hotkeys Mod+C/X/V, findNode traversal, sort mode dispatch | Mock activeStore, treeStore, clipboard, Watcher, Pass |
| **AddStoreWizard** | 370 | Multi-step navigation, name/path validation, createStore() orchestration (mkdir → pass init → config save), GPG key loading, wizard reset | Mock Gpg, Pass, Config, Fs |
| **GpgTab** | 270 | Tag add/remove/edit with keyboard (Enter/comma/Backspace/Escape), signing/recipient key mode switching | Mock Gpg service |
| **StoresTab** | 308 | storeEntries sorting (active first), isPathUnique, saveEditStore validation + emit, confirmDeleteStore | Provided stores prop |
| **EntryDetail** | 299 | toggleSecret, copySecret/copyValue clipboard + toast, skeleton timer (500ms), getLabel friendly names | Mock clipboard store, fake timers for skeleton |

#### 3 lightweight — pure function extraction + shallow mount

| Component | LOC | What to test |
|-----------|-----|-------------|
| **CreateFolderDialog** | 102 | buildFullPath() joining, handleSubmit() empty-name validation |
| **RenameEntryDialog** | 135 | currentName/parentDir path parsing, buildNewPath(), same-name guard |
| **MoveOrDuplicateDialog** | 238 | buildFullDestination() joining, mode-dependent labels, handleSubmit() guards |

### Exempt (no tests)

| Category | Files | Rationale |
|----------|-------|-----------|
| Dialog passthroughs | DeleteConfirmDialog, StoreDeleteDialog | Single-action AlertDialog passthrough |
| Thin wrappers | EditEntryDialog, InsertDialog, PasswordGenerator, GenerateDialog | Trivial validation, form passthrough |
| Recursive display | DirectoryTree | Trivial expand/collapse |
| Settings form tabs | ClipboardTab, ExtensionsTab, GenerationTab, InfoTab, PreferencesTab | Pure model bindings |
| Mode toggle | ModeToggle | Trivial dropdown |
| Readiness | ReadinessGate, BlockedScreen, IssueCard, LoadingScreen | Tested at integration level |
| Pages | index.vue, settings.vue, test.vue | Integration-level orchestration |
| Icons | 5 Icon*.vue files | Pure SVG stubs |

### Component test pattern

```ts
// client/src/components/__tests__/EntryForm.test.ts
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EntryForm from "../EntryForm.vue";

describe("EntryForm", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
  });

  it("shows validation error when path is empty on submit", async () => {
    const wrapper = mount(EntryForm, {
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })] },
    });
    // ...set form state, trigger submit, assert error message
  });
});
```

---

## 7. Integration Tests (Podman/Docker Container)

### Container

**File:** `Containerfile.test` at project root.

- Base: `node:24-alpine` (38.7 MiB, 64 packages)
- Tools: gnupg, pass, git, pnpm@11.9.0
- User: `testuser` with writable home
- Build: `podman build -t pass-gui-test -f Containerfile.test .`

### Test files

**Directory:** `tests/integration/`

```
tests/integration/
├── gpg-pass.test.ts          # Proof-of-concept: GPG key gen, pass init/insert/show/ls/rm
├── scripts/
│   └── setup-test-store.sh   # Helper for manual test store setup
```

### How to run

```bash
# Build image (once)
podman build -t pass-gui-test -f Containerfile.test .

# Run integration tests
podman run --rm -v $(pwd):/app -w /app pass-gui-test \
  bash -c "pnpm install --frozen-lockfile && pnpm --filter=client vitest run tests/integration/"
```

### What integration tests verify

- GPG key generation via `gpg --batch --gen-key`
- pass store initialization via `pass init`
- pass insert, show, ls, rm operations
- Multiple GNUPGHOME overrides (per-store isolation)
- pass git integration

### Key environment variables

| Var | Purpose |
|-----|---------|
| `GNUPGHOME` | GPG keyring directory |
| `PASSWORD_STORE_DIR` | pass store location |
| `HOME` | Must be writable for GPG |

---

## 8. CI/CD

**File:** `.github/workflows/ci.yml`

Three conditional trigger levels in a single job:

| Level | Trigger | Steps |
|-------|---------|-------|
| **Quick** | Push (any branch) | typecheck → lint → test:unit |
| **Full** | PR to main or tag push | Quick + test:coverage + Docker integration tests |
| **Release** | Tag push `v*` | Full + build + release |

### Key design decisions

| Decision | Choice |
|----------|--------|
| Strategy | Single job with conditional steps (no multi-job artifact complexity) |
| Concurrency | Group by ref, cancel-in-progress on new pushes |
| pnpm | `pnpm/action-setup@v4` with version 11.9.0 |
| Node | `actions/setup-node@v4` with Node 24, pnpm cache |
| Docker in CI | `docker build` + `docker run` (Docker available on ubuntu-latest) |
| Coverage | Thresholds enforced in vitest.config.ts (not CI YAML) |

---

## 9. Coverage Targets

| Threshold | Level | Enforcement |
|-----------|-------|-------------|
| Warning < 60% | Total | CI log message, non-blocking |
| PR Block < 75% | New code | Blocks merge |
| Target 80% | Total | Quarterly aspirational |
| 100% pass | Integration | Hard block (all must pass) |

### Exempt from coverage

- `src/test/**` — test infrastructure
- `src/**/*.d.ts` — type declarations
- `src/**/*.test.ts` — test files themselves
- `src/components/ui/**` — shadcn-vue wrappers
- Generated code
- Type-only files

---

## 10. File Organization

```
client/
├── vitest.config.ts                          # Vitest config (separate from vite.config.ts)
├── src/
│   ├── test/
│   │   ├── setup.ts                          # Global Neu mock (vi.hoisted + vi.mock)
│   │   ├── vitest.d.ts                       # Vitest global type declarations
│   │   └── smoke.test.ts                     # Min smoke test: 1+1=2
│   ├── __mocks__/                            # (future) auto-hoisted mock files
│   ├── lib/
│   │   ├── parse-pass-show.ts
│   │   └── parse-pass-show.test.ts           # Co-located unit tests
│   ├── services/
│   │   ├── neutralino.ts
│   │   └── neutralino.test.ts                # Co-located service tests
│   ├── stores/
│   │   ├── active-store.ts
│   │   ├── __tests__/
│   │   │   └── active-store.test.ts          # Option: subdir for store tests
│   │   └── ...                               # Or co-located
│   ├── composables/
│   │   ├── useTreeState.ts
│   │   └── useTreeState.test.ts              # Co-located composable tests
│   └── components/
│       ├── EntryForm.vue
│       ├── __tests__/
│       │   └── EntryForm.test.ts             # Subdir for component tests
│       └── ...
├── tests/
│   └── integration/
│       ├── gpg-pass.test.ts                  # Container-backed integration tests
│       └── scripts/
│           └── setup-test-store.sh
├── Containerfile.test                        # Podman/Docker integration test image
└── .github/
    └── workflows/
        └── ci.yml                            # CI/CD workflow
```

**Convention:** Co-locate `.test.ts` next to the source module for
lib/services/composables. Use `__tests__/` subdirectory for stores and
components (where the test file name matches the component name).

---

## 11. Quick Start

```bash
# 1. Run existing smoke test
pnpm test

# 2. Run with coverage
pnpm test:coverage

# 3. Run in watch mode (for development)
pnpm --filter=client test:watch

# 4. Build and run integration tests (requires Podman/Docker)
podman build -t pass-gui-test -f Containerfile.test .
podman run --rm -v $(pwd):/app -w /app pass-gui-test \
  bash -c "pnpm install --frozen-lockfile && pnpm --filter=client vitest run tests/integration/"

# 5. Typecheck and lint before committing
pnpm typecheck && pnpm lint
```

### Writing a new test

1. Identify the layer (lib → service → store/composable → component → integration)
2. Follow the priority order (P0 → P6)
3. Co-locate the test file next to the source (or in `__tests__/` for components)
4. Import `vi.mock()` for any module-level mocking needed
5. Use `@pinia/testing` `createTestingPinia()` for store-dependent tests
6. Use `vi.useFakeTimers()` for any timer-dependent logic
7. Run `pnpm test` to verify
8. Run `pnpm typecheck` to ensure types compile

> **Remember:** The Neu mock is already set up globally in `setup.ts`.
> You rarely need `vi.mock("@neutralinojs/lib")` in individual test files.
> Service-level mocking (`vi.mock("@/services/...")`) covers what stores need.
