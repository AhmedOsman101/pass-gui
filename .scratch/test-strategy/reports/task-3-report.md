# Task 3 Report: Store & Composable Test Patterns

## Inventory

### Stores (565 LOC total)

| File                                | LOC | Dependencies                                                                           | Public API                                                                                                                                                                                                                                                                                                           | Side Effects                                                                                     |
| ----------------------------------- | --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `client/src/stores/active-store.ts` | 126 | `@/services/config` (Config), `@/services/pass` (Pass), `@/lib/path` (Path)            | `load()`, `switchTo()`, `getGpgHome()`; refs: `storePath`, `storeName`, `isValidating`, `error`, `currentStoreConfig`; computed: `hasStore`                                                                                                                                                                          | Async I/O in `load()`/`switchTo()`, no timers/watchers                                           |
| `client/src/stores/clipboard.ts`    | 109 | `@/services/clipboard` (Clipboard)                                                     | `copy()`, `clear()`, `startTimer()`, `stopTimer()`; refs: `lastAction`, `remainingMs`, `isCopied`, `error`, `timerId`; computed: `isActive`, `formattedRemaining`                                                                                                                                                    | `setTimeout` timer with drift correction loop, `clearTimeout`                                    |
| `client/src/stores/entry-form.ts`   | 49  | None                                                                                   | `openCreateForm()`, `openEditForm()`, `closeForm()`; refs: `formMode`, `formPath`, `formPresetPassword`; computed: `isFormOpen`                                                                                                                                                                                      | None                                                                                             |
| `client/src/stores/entry-tree.ts`   | 212 | `@/services/entries` (Entries), `@/services/filesystem` (Fs), `@/services/pass` (Pass) | `loadTree()`, `selectEntry()`, `setCurrentPath()`, `clearSelection()`, `refresh()`, `insertEntry()`, `removeEntry()`, `moveEntry()`, `duplicateEntry()`, `editEntry()`, `createFolder()`, `setSortMode()`; refs: `tree`, `currentPath`, `currentEntry`, `isLoadingTree`, `error`, `sortMode`; computed: `hasEntries` | All CRUD ops are async with store side-effects (refresh after mutation, selectEntry after write) |
| `client/src/stores/readiness.ts`    | 69  | `@/services/readiness` (Readiness)                                                     | `evaluate()`, `reset()`; refs: `snapshot`, `isEvaluating`, `error`; computed: `state`, `isReady`, `blockingIssues`, `infoIssues`                                                                                                                                                                                     | Async I/O in `evaluate()`                                                                        |

### Composables (264 LOC total)

| File                                               | LOC | Dependencies                                                                      | Return Values                                                                                                                                                                                 | Side Effects                                                        |
| -------------------------------------------------- | --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `client/src/composables/use-clipboard-buffer.ts`   | 61  | `@/services/filesystem` (Fs), `@/stores/entry-tree` (useEntryTreeStore)           | `buffer` (readonly ref), `copyEntry()`, `cutEntry()`, `pasteEntry()`                                                                                                                          | None beyond calling store actions                                   |
| `client/src/composables/use-generation-config.ts`  | 25  | `@/services/config` (Config), `@/lib/constants` (DEFAULT_CONFIG)                  | `options` (reactive)                                                                                                                                                                          | Fire-and-forget `Promise.all` in IIFE on creation                   |
| `client/src/composables/use-password-generator.ts` | 30  | `./use-generation-config`, `@/lib/generate-password`                              | `state` (reactive with `options`, `generated`, `regenerate()`)                                                                                                                                | `watchEffect` triggers `regenerate()` on option change              |
| `client/src/composables/useTreeState.ts`           | 148 | `@/stores/entry-tree` (useEntryTreeStore), `@/lib/tree-index`, `@/lib/tree-state` | `visibleNodes`, `expandedDirs`, `focusedPath`, `selectedPath`, `mode`, `index`, `toggleDir`, `selectFile`, `toggleSelect`, `focusNext`, `focusPrev`, `focusSelect`, `arrowRight`, `arrowLeft` | `watch()` on `treeStore.tree` rebuilds index + prunes expanded dirs |

---

## Test Patterns

### 5a. Setup Store (ActiveStore) — Minimal deps, config-driven

**Pattern:** Create testing Pinia instance with `@pinia/testing`, mock services at module level.

```ts
// client/src/stores/__tests__/active-store.test.ts
import { createTestingPinia } from "@pinia/testing";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/types/config";

vi.mock("@/services/config", () => ({
  Config: {
    getValue: vi.fn(),
    load: vi.fn(),
    setValue: vi.fn(),
  },
}));

import { Config } from "@/services/config";
import { useActiveStoreStore } from "@/stores/active-store";

function mockConfigResult<T>(value: T) {
  return { isError: () => false, ok: value } as any;
}

function mockErr(message: string) {
  return { isError: () => true, error: { message } } as any;
}

describe("active-store", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.clearAllMocks();
  });

  it("loads active store from config and resolves path", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(mockConfigResult("work"));
    vi.mocked(Config.load).mockResolvedValue(
      mockConfigResult({
        data: {
          stores: {
            work: {
              path: "~/.password-store/work",
              gnupg_home: "/home/user/.gnupg",
            },
          },
        },
      } as AppConfig)
    );

    const store = useActiveStoreStore();
    await store.load();

    expect(store.storeName).toBe("work");
    expect(store.storePath).toContain(".password-store/work");
    expect(store.isValidating).toBe(false);
    expect(store.error).toBeNull();
  });

  it("sets error when config load fails", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(mockConfigResult("work"));
    vi.mocked(Config.load).mockResolvedValue(mockErr("Config file not found"));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toContain("Config file not found");
    expect(store.storeName).toBeNull();
  });

  it("sets error when store key not in config", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(
      mockConfigResult("missing-store")
    );
    vi.mocked(Config.load).mockResolvedValue(
      mockConfigResult({
        data: { stores: { work: { path: "/some/path" } } },
      } as AppConfig)
    );

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toContain('Store "missing-store" not found');
  });
});
```

### 5b. Store with Service Mocks (EntryTree) — CRUD operations via pass service

**Pattern:** `vi.mock("@/services/entries")`, `vi.mock("@/services/filesystem")`, `vi.mock("@/services/pass")` at module level. Test store actions through public API. Mock service return values and assert store state changes.

```ts
// client/src/stores/__tests__/entry-tree.test.ts
import { createTestingPinia } from "@pinia/testing";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/entries", () => ({
  Entries: {
    list: vi.fn(),
    show: vi.fn(),
    insert: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    copy: vi.fn(),
    edit: vi.fn(),
  },
}));

vi.mock("@/services/filesystem", () => ({
  Fs: {
    join: vi.fn((...parts: string[]) => Promise.resolve(parts.join("/"))),
    mkdir: vi.fn(),
  },
}));

vi.mock("@/services/pass", () => ({
  Pass: { storeDirectory: "/home/user/.password-store" },
}));

import { Entries } from "@/services/entries";
import { Fs } from "@/services/filesystem";
import { useEntryTreeStore } from "@/stores/entry-tree";

function ok<T>(value: T): any {
  return { isError: () => false, ok: value };
}

function err(msg: string): any {
  return { isError: () => true, error: { message: msg } };
}

describe("entry-tree", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.clearAllMocks();
  });

  it("loads tree from Entries.list()", async () => {
    const mockTree = [
      { name: "Email", type: "DIRECTORY", path: "Email", children: [] },
    ];
    vi.mocked(Entries.list).mockResolvedValue(ok(mockTree));

    const store = useEntryTreeStore();
    await store.loadTree();

    expect(store.tree).toEqual(mockTree);
    expect(store.isLoadingTree).toBe(false);
    expect(store.hasEntries).toBe(true);
  });

  it("insertEntry calls Entries.insert then refreshes", async () => {
    vi.mocked(Entries.list).mockResolvedValue(ok([]));
    vi.mocked(Entries.insert).mockResolvedValue(
      ok({ success: true, path: "Email/new-entry" })
    );
    vi.mocked(Entries.show).mockResolvedValue(
      ok({
        name: "new-entry",
        path: "Email/new-entry",
        body: "pass123\n",
        raw: "pass123\n",
        fields: {},
      })
    );

    const store = useEntryTreeStore();
    const errMsg = await store.insertEntry("Email/new-entry", "pass123\n");

    expect(errMsg).toBeNull();
    expect(Entries.insert).toHaveBeenCalledWith({
      path: "Email/new-entry",
      content: "pass123\n",
    });
    expect(Entries.list).toHaveBeenCalled(); // refresh
    expect(Entries.show).toHaveBeenCalledWith("Email/new-entry", true);
  });

  it("insertEntry returns error message on failure", async () => {
    vi.mocked(Entries.insert).mockResolvedValue(err("Entry already exists"));

    const store = useEntryTreeStore();
    const errMsg = await store.insertEntry("Email/existing", "pass\n");

    expect(errMsg).toBe("Entry already exists");
    expect(store.error).toBe("Entry already exists");
  });

  it("removeEntry calls Entries.remove, clears selection, refreshes", async () => {
    vi.mocked(Entries.list).mockResolvedValue(ok([]));
    vi.mocked(Entries.remove).mockResolvedValue(
      ok({ success: true, path: "Email/old" })
    );

    const store = useEntryTreeStore();
    store.currentPath = "Email/old";
    const errMsg = await store.removeEntry("Email/old");

    expect(errMsg).toBeNull();
    expect(Entries.remove).toHaveBeenCalledWith("Email/old");
    expect(store.currentPath).toBeNull();
    expect(store.currentEntry).toBeNull();
  });
});
```

### 5c. Timer-based Store (Clipboard) — setTimeout/clearTimeout with drift correction

**Pattern:** `vi.useFakeTimers()` for all timer tests. `vi.advanceTimersByTime()` to simulate passage. Mock the Clipboard service. Never use `setTimeout` in assertions.

```ts
// client/src/stores/__tests__/clipboard.test.ts
import { createTestingPinia } from "@pinia/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/clipboard", () => ({
  Clipboard: {
    writeText: vi.fn(),
    clear: vi.fn(),
  },
}));

import { Clipboard } from "@/services/clipboard";
import { useClipboardStore } from "@/stores/clipboard";

function ok<T>(value: T): any {
  return { isError: () => false, ok: value };
}

function err(msg: string): any {
  return { isError: () => true, error: { message: msg } };
}

describe("clipboard store timer", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies secret and starts timer", async () => {
    const expiresAt = Date.now() + 30_000;
    const clipAction = {
      path: "Email/test",
      selection: "clipboard",
      timerSeconds: 30,
      expiresAt,
    };

    vi.mocked(Clipboard.writeText).mockResolvedValue(ok(clipAction));

    const store = useClipboardStore();
    const result = await store.copy("secret123", "Email/test");

    expect(result).toEqual(clipAction);
    expect(store.isCopied).toBe(true);
    expect(store.isActive).toBe(true);
    expect(Clipboard.writeText).toHaveBeenCalledWith("secret123", "Email/test");
  });

  it("decrements remainingMs via drift-correction timer ticks", async () => {
    const now = Date.now();
    const expiresAt = now + 30_000;
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      ok({ path: "x", selection: "clipboard", timerSeconds: 30, expiresAt })
    );

    const store = useClipboardStore();
    await store.copy("secret", "x");

    expect(store.remainingMs).toBe(30_000);

    vi.advanceTimersByTime(1_000);
    expect(store.remainingMs).toBe(29_000);

    vi.advanceTimersByTime(28_000);
    expect(store.remainingMs).toBe(1_000);
  });

  it("clears clipboard when timer expires and resets state", async () => {
    const now = Date.now();
    const expiresAt = now + 10_000;
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      ok({ path: "x", selection: "clipboard", timerSeconds: 10, expiresAt })
    );
    // clear() is called when timer fires
    vi.mocked(Clipboard.clear).mockResolvedValue(ok(undefined));

    const store = useClipboardStore();
    await store.copy("secret", "x");

    // advance past expiry
    vi.advanceTimersByTime(11_000);

    expect(Clipboard.clear).toHaveBeenCalled();
    expect(store.isCopied).toBe(false);
    expect(store.isActive).toBe(false);
    expect(store.remainingMs).toBe(0);
  });

  it("stops timer on explicit clear()", async () => {
    const expiresAt = Date.now() + 30_000;
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      ok({ path: "x", selection: "clipboard", timerSeconds: 30, expiresAt })
    );
    vi.mocked(Clipboard.clear).mockResolvedValue(ok(undefined));

    const store = useClipboardStore();
    await store.copy("secret", "x");
    expect(store.remainingMs).toBe(30_000);

    await store.clear();

    expect(Clipboard.clear).toHaveBeenCalled();
    expect(store.isCopied).toBe(false);
    expect(store.remainingMs).toBe(0);

    // Advance past original expiry — no second clear
    vi.advanceTimersByTime(31_000);
    expect(Clipboard.clear).toHaveBeenCalledTimes(1);
  });

  it("handles clipboard write error", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      err("Clipboard access denied")
    );

    const store = useClipboardStore();
    const result = await store.copy("secret", "x");

    expect(result).toBeNull();
    expect(store.error).toContain("Clipboard access denied");
    expect(store.isCopied).toBe(false);
  });

  it("formats remaining time", async () => {
    const expiresAt = Date.now() + 63_000;
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      ok({ path: "x", selection: "clipboard", timerSeconds: 63, expiresAt })
    );

    const store = useClipboardStore();
    await store.copy("secret", "x");

    expect(store.formattedRemaining).toBe("63s");

    vi.advanceTimersByTime(3_500);
    expect(store.formattedRemaining).toBe("60s");
  });
});
```

### 5d. Composable with Store Coupling (useTreeState) — depends on EntryTree store

**Pattern:** Mock the store with `@pinia/testing`, create in test. Provide the store's reactive state, then exercise composable functions.

```ts
// client/src/composables/__tests__/useTreeState.test.ts
import { createTestingPinia } from "@pinia/testing";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useEntryTreeStore } from "@/stores/entry-tree";
import { useTreeState } from "@/composables/useTreeState";
import type { EntryTree } from "@/types/entries";

function makeTree(): EntryTree {
  return [
    {
      name: "Email",
      path: "Email",
      type: "DIRECTORY",
      children: [
        { name: "work", path: "Email/work", type: "FILE", fields: {} },
        { name: "personal", path: "Email/personal", type: "FILE", fields: {} },
      ],
    },
    {
      name: "Social",
      path: "Social",
      type: "DIRECTORY",
      children: [
        { name: "twitter", path: "Social/twitter", type: "FILE", fields: {} },
      ],
    },
  ];
}

describe("useTreeState", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
  });

  it("initializes visible nodes from tree store", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();
    treeStore.sortMode = "alphabetical";

    const { visibleNodes } = useTreeState();

    // Default: tree mode, all dirs collapsed — only root dirs visible
    expect(visibleNodes.value.length).toBe(2);
    expect(visibleNodes.value[0].name).toBe("Email");
    expect(visibleNodes.value[1].name).toBe("Social");
  });

  it("toggleDir expands and collapses directory", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const { visibleNodes, toggleDir } = useTreeState();

    toggleDir("Email");
    expect(visibleNodes.value.length).toBe(3); // Email + work + personal
    expect(visibleNodes.value[1].name).toBe("work");
    expect(visibleNodes.value[2].name).toBe("personal");

    toggleDir("Email");
    expect(visibleNodes.value.length).toBe(2); // Back to both root dirs
  });

  it("focusNext cycles forward through visible nodes", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const { focusedPath, focusNext } = useTreeState();

    focusNext();
    expect(focusedPath.value).toBe("Email");

    focusNext();
    expect(focusedPath.value).toBe("Social");

    focusNext();
    expect(focusedPath.value).toBe("Email"); // wraps around
  });

  it("focusPrev cycles backward", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const { focusedPath, focusPrev } = useTreeState();

    focusPrev();
    expect(focusedPath.value).toBe("Social"); // starts from end

    focusPrev();
    expect(focusedPath.value).toBe("Email");
  });

  it("selectFile on directory calls setCurrentPath, on FILE calls selectEntry", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();
    treeStore.currentPath = null;

    const { selectFile } = useTreeState();

    selectFile("Email");
    expect(treeStore.setCurrentPath).toHaveBeenCalledWith("Email");

    selectFile("Email/work");
    expect(treeStore.selectEntry).toHaveBeenCalledWith("Email/work");
  });

  it("arrowRight opens dir if collapsed, moves into first child if expanded", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const { focusedPath, expandedDirs, arrowRight } = useTreeState();

    focusedPath.value = "Email";
    arrowRight();
    expect(expandedDirs.value.has("Email")).toBe(true);

    arrowRight();
    expect(focusedPath.value).toBe("Email/work");
  });

  it("search mode filters visible nodes", () => {
    const treeStore = useEntryTreeStore();
    treeStore.tree = makeTree();

    const searchQuery = ref("twit");
    const { visibleNodes, mode } = useTreeState(searchQuery);

    expect(mode.value).toBe("search");
    expect(visibleNodes.value.length).toBe(1);
    expect(visibleNodes.value[0].path).toBe("Social/twitter");
  });
});
```

### 5e. Crypto-dependent Composable (usePasswordGenerator)

**Pattern:** Mock `crypto.getRandomValues` via `vi.stubGlobal()`. Mock the `generate-password` lib functions (since they call `crypto.getRandomValues`). Mock `useGenerationConfig` to avoid Config service dependency.

```ts
// client/src/composables/__tests__/usePasswordGenerator.test.ts
import { describe, expect, it, vi } from "vitest";

// Mock the generation config composable (avoids Config service dep)
vi.mock("@/composables/use-generation-config", () => ({
  useGenerationConfig: () => ({
    options: {
      memorable: false,
      length: 20,
      symbols: true,
    },
  }),
}));

vi.mock("@/lib/generate-password", () => ({
  generatePassword: vi.fn(),
  generateMemorablePassword: vi.fn(),
}));

import {
  generatePassword,
  generateMemorablePassword,
} from "@/lib/generate-password";
import { usePasswordGenerator } from "@/composables/use-password-generator";

describe("usePasswordGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates password on creation with default options", () => {
    vi.mocked(generatePassword).mockReturnValue("mocked-password-abc123");

    const state = usePasswordGenerator();

    expect(state.generated).toBe("mocked-password-abc123");
    expect(generatePassword).toHaveBeenCalledWith(20, "[[:alnum:]][[:punct:]]");
  });

  it("regenerate re-calls generatePassword with current options", () => {
    vi.mocked(generatePassword).mockReturnValue("first");
    const state = usePasswordGenerator();

    vi.mocked(generatePassword).mockReturnValue("second");
    state.regenerate();

    expect(state.generated).toBe("second");
  });

  it("uses generateMemorablePassword when memorable is true", () => {
    vi.mocked(generatePassword).mockReturnValue("not-called");
    vi.mocked(generateMemorablePassword).mockReturnValue(
      "2787-brave-buffalo-sabrina"
    );

    vi.mock("@/composables/use-generation-config", () => ({
      useGenerationConfig: () => ({
        options: { memorable: true, length: 20, symbols: false },
      }),
    }));

    const state = usePasswordGenerator();
    expect(state.generated).toBe("2787-brave-buffalo-sabrina");
    expect(generateMemorablePassword).toHaveBeenCalled();
    expect(generatePassword).not.toHaveBeenCalled();
  });
});
```

---

## Additional Patterns

### Testing Pinia Watchers (`$subscribe`, `$onAction`)

```ts
import { createTestingPinia } from "@pinia/testing";
import { useEntryTreeStore } from "@/stores/entry-tree";

it("$subscribe fires on state change", () => {
  createTestingPinia({ createSpy: vi.fn });
  const store = useEntryTreeStore();
  const spy = vi.fn();

  store.$subscribe(spy);
  store.tree = [{ name: "Test", path: "Test", type: "FILE", fields: {} }];

  expect(spy).toHaveBeenCalled();
  // spy args: (mutation, state)
  // mutation.type === "direct" for direct ref assignment
  // mutation.type === "patch object" for $patch({})
});

it("$onAction intercepts store actions", () => {
  createTestingPinia({ createSpy: vi.fn });
  const store = useEntryTreeStore();
  const spy = vi.fn();

  store.$onAction(spy);
  store.clearSelection();

  expect(spy).toHaveBeenCalled();
  // spy arg: { name: "clearSelection", args: [], after, onError }
});
```

### Testing Store Factory Functions

If a store is created with a factory that accepts config:

```ts
it("creates store with custom config", () => {
  createTestingPinia({ createSpy: vi.fn });
  const store = useEntryTreeStore();

  // Set initial state via $patch if needed
  store.$patch({
    tree: mockTree,
    sortMode: "reverse-alphabetical",
  });

  // Or set refs directly for setup stores
  store.tree = mockTree;
  store.sortMode = "reverse-alphabetical";

  // Test derived state
  expect(store.hasEntries).toBe(true);
});
```

### Testing Store That Uses `useRouter` or `useRoute`

```ts
import { createTestingPinia } from "@pinia/testing";
import { createRouter, createMemoryHistory } from "vue-router";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/", component: { template: "<div/>" } }],
});

it("store action interacts with router", async () => {
  createTestingPinia({
    createSpy: vi.fn,
    // Plugins array needed if store depends on router plugin
  });
  // Set `$router` on the Pinia instance if needed:
  // const pinia = createTestingPinia(...)
  // pinia.use(() => ({ $router: router }));
  // If store calls useRouter() inside, need router plugin installed
});
```

---

## Summary of Mock Strategies

| Dependency                            | How to Mock                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@/services/config` (Config)          | `vi.mock("@/services/config")` — factory returns `{ Config: { load: vi.fn(), getValue: vi.fn(), setValue: vi.fn() } }` |
| `@/services/pass` (Pass)              | `vi.mock("@/services/pass")` — stub `{ Pass: { storeDirectory: "..." } }` or create full mock                          |
| `@/services/entries` (Entries)        | `vi.mock("@/services/entries")` — mock `list`, `show`, `insert`, `remove`, `move`, `copy`, `edit`                      |
| `@/services/clipboard` (Clipboard)    | `vi.mock("@/services/clipboard")` — mock `writeText`, `clear`                                                          |
| `@/services/readiness` (Readiness)    | `vi.mock("@/services/readiness")` — mock `check`                                                                       |
| `@/services/filesystem` (Fs)          | `vi.mock("@/services/filesystem")` — mock `join`, `mkdir`, etc.                                                        |
| `crypto.getRandomValues`              | `vi.stubGlobal("crypto", { getRandomValues: vi.fn() })`                                                                |
| `@neutralinojs/lib`                   | Already mocked globally in `setup.ts`. Use `vi.mocked(Neu)` to access if needed.                                       |
| Pinia stores in composables           | `createTestingPinia({ createSpy: vi.fn })` — set refs directly on the store instance                                   |
| `@/composables/use-generation-config` | `vi.mock("@/composables/use-generation-config")` — return `{ options: { memorable, length, symbols } }`                |
