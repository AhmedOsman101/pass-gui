# Frontend UI — Implementation Plan

> **Spec**: `docs/specs/frontend-ui.md`
> **Roadmap**: `docs/roadmap/04-frontend-after-backend.md`
> **Depends on**: Phase 02 (readiness) + Phase 03 (entry ops) completely implemented

## Goal

Build the user interface that consumes the backend contracts. The app renders the correct screen based on readiness state — blocked screens with actionable recovery guidance when deps are missing, or the password list when ready. Implements Pinia stores, app shell, entry tree, detail panel, clipboard UX, mutation dialogs, search, and settings. Every screen reflects backend state rather than inventing its own.

## Prerequisites

- Phase 02 types exist: `ReadinessState` (10-state union), `ReadinessIssue` (discriminated union), `ReadinessSnapshot`, `ReadinessIssueCode` at `client/src/types/readiness.ts`
- `ReadinessService.check()` orchestrator exists at `client/src/services/readiness.ts`
- No Pinia readiness store yet — Phase 04 will create `client/src/stores/readiness.ts`
- Phase 03 types exist: `EntryTree`, `EntryNode`, `EntryDetail`, `MutationInput`, `MutationResult`, `ClipboardAction`, `ClipboardState`, `ClipboardSelection`, `EntriesStoreState`, `ClipboardStoreState`
- `EntriesService` exists at `client/src/services/entries.ts` with `list`, `show`, `insert`, `generate`, `remove`, `move`. All methods use `neu.execCmd()` or `pass.execScoped()` for execution.
- `ClipboardService` exists at `client/src/services/clipboard.ts` with `write` and `clear` (no timer in service)
- Phase 03 parsers exist: `parsePassLsOutput`, `parsePassShowOutput` at `client/src/lib/`
- Phase 03 error classes exist: `EntryNotFoundError`, `EntryAlreadyExistsError`, `EntryParseError`, `ClipboardError`, `MutationError`
- `main.ts` still blocks on `gpgInitialized`/`passInitialized` (Phase 05 will remove these)
- `vue-router` is installed and configured
- shadcn-vue components installed: sidebar (full suite), button, input, separator, skeleton, tooltip, breadcrumb, sheet, collapsible, dropdown-menu, `dialog`, `card`
- `ModeToggle.vue` exists and works at `client/src/components/`
- `neu.execCmd()` still throws `CommandFailedError` on non-zero exit (Phase 05 may change this)

## Before Starting

**Install missing shadcn-vue components** (dialog and card are NOT currently installed):
```bash
cd client && npx shadcn-vue add dialog card
```

## New Types Required

None — all types defined in Phase 02 (`client/src/types/index.ts`) and Phase 03 (`client/src/types/entries.ts`).

## New Files to Create — Pinia Stores

### 1. `client/src/stores/entries.ts`

**Responsibility**: Pinia store managing entry tree, selection, search, and mutation actions. Consumes `EntriesService`.

**Exports**:
```ts
function useEntriesStore(): {
  tree: Ref<EntryTree | null>;
  selectedPath: Ref<string | null>;
  selectedDetail: Ref<EntryDetail | null>;
  searchQuery: Ref<string>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  filteredTree: ComputedRef<EntryTree | null>;
  list: () => Promise<void>;
  select: (path: string) => Promise<void>;
  search: (query: string) => void;
  insert: (input: MutationInput) => Promise<Result<MutationResult>>;
  generate: (path: string, length?: number, noSymbols?: boolean) => Promise<Result<MutationResult>>;
  remove: (path: string) => Promise<Result<MutationResult>>;
  move: (oldPath: string, newPath: string) => Promise<Result<MutationResult>>;
};
```

### 2. `client/src/stores/clipboard.ts`

**Responsibility**: Pinia store wrapping `ClipboardService` with reactive timer state. Timer logic lives here (not in the service).

**Exports**:
```ts
function useClipboardStore(): {
  lastAction: Ref<ClipboardAction | null>;
  remainingMs: Ref<number>;
  isActive: ComputedRef<boolean>;
  copy: (path: string) => Promise<void>;
  clear: () => Promise<void>;
  abort: () => void;
};
```

### 3. `client/src/stores/store-context.ts`

**Responsibility**: Reactive holder of active store metadata. Pulls from readiness snapshot or ConfigService.

**Exports**:
```ts
function useStoreContextStore(): {
  activeStoreName: Ref<string | null>;
  storePath: Ref<string | null>;
  gnupgHome: Ref<string | null>;
  refresh: () => Promise<void>;
};
```

### 4. `client/src/composables/useClipboardTimer.ts`

**Responsibility**: Reactive countdown timer used by clipboard store.

**Exports**:
```ts
function useClipboardTimer(): {
  remaining: Ref<number>;
  isRunning: Ref<boolean>;
  start: (durationMs: number) => void;
  stop: () => void;
};
```

## New Files to Create — Pages

### 5. `client/src/pages/blocked.vue`

**Responsibility**: Readiness blocked-state screen. Reads `ReadinessStore`, shows issues with actionable recovery guidance, retry button.

### 6. `client/src/pages/passwords.vue`

**Responsibility**: Main password management view. Two-panel layout with entry tree sidebar and detail panel. Calls `entriesStore.list()` on mount, shows skeleton while loading, handles empty state.

### 7. `client/src/pages/settings.vue`

**Responsibility**: Config editing page. Sections for general, generation, clipboard, GPG info. Save writes via ConfigService. Store switch triggers readiness re-check.

## New Files to Create — Components

### 8. `client/src/components/PasswordTree.vue`

**Responsibility**: Recursive collapsible tree driven by `entriesStore.filteredTree`. Replaces existing `Tree.vue`.

### 9. `client/src/components/EntryDetail.vue`

**Responsibility**: Detail panel for selected entry. Masked password (toggle reveal), metadata table, copy button, remove action.

### 10. `client/src/components/EntryCreateDialog.vue`

**Responsibility**: Dialog for creating entry. Two modes: Insert (manual) and Generate (auto). Uses shadcn-vue Dialog.

### 11. `client/src/components/EntryRemoveDialog.vue`

**Responsibility**: Confirm removal dialog. Confirmation checkbox required before Remove enabled. Uses shadcn-vue Dialog.

### 12. `client/src/components/SearchBar.vue`

**Responsibility**: Debounced search input with clear button and result count.

### 13. `client/src/components/ClipboardIndicator.vue`

**Responsibility**: Visual indicator next to copy button. States: idle, copying, active (countdown), cleared.

### 14. `client/src/components/BlockedState.vue`

**Responsibility**: Reusable card for displaying a single readiness issue with icon, description, optional action button.

## Files to Modify

### 1. `client/src/router/index.ts`

**Replace**: Auto-routes with explicit route definitions and a navigation guard.

**New routes**:
```ts
const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/passwords" },
  { path: "/blocked", component: () => import("@/pages/blocked.vue") },
  { path: "/passwords", component: () => import("@/pages/passwords.vue") },
  { path: "/passwords/:pathMatch(.*)*", component: () => import("@/pages/passwords.vue") },
  { path: "/settings", component: () => import("@/pages/settings.vue") },
];
```

**Remove**: `import { handleHotUpdate, routes } from "vue-router/auto-routes"` and `handleHotUpdate` call.

**Navigation guard** (`beforeEach`):

```ts
router.beforeEach(async (to) => {
  const readinessStore = useReadinessStore();

  if (to.path === "/settings") return true; // always accessible

  // Only trigger readiness check if we don't have a snapshot yet
  if (!readinessStore.snapshot && !readinessStore.loading) {
    await readinessStore.checkReadiness();
  }

  if (readinessStore.loading) {
    // Wait for readiness check to complete before deciding route
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => readinessStore.loading,
        (val) => { if (!val) { unwatch(); resolve(); } },
        { immediate: true }
      );
    });
  }

  if (!readinessStore.isReady && to.path !== "/blocked") return "/blocked";
  if (readinessStore.isReady && to.path === "/blocked") return "/passwords";
  return true;
});
```

**Lazy loading**: Use `component: () => import('@/pages/...')` for all routes.

### 2. `client/src/App.vue`

**Replace**: Current logo-only shell with full app layout using shadcn-vue sidebar:

```vue
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useReadinessStore } from "@/stores/readiness";
import { useRouter } from "vue-router";
import AppSidebar from "@/components/AppSidebar.vue";
import ModeToggle from "@/components/ModeToggle.vue";
import SearchBar from "@/components/SearchBar.vue";

const readinessStore = useReadinessStore();
const router = useRouter();
</script>

<template>
  <SidebarProvider>
    <Sidebar><AppSidebar /></Sidebar>
    <SidebarInset>
      <header class="flex items-center gap-2 px-4 py-2 border-b">
        <SidebarTrigger />
        <SearchBar v-if="readinessStore.isReady" />
        <div class="ml-auto flex items-center gap-2">
          <ModeToggle />
          <Button variant="ghost" @click="router.push('/settings')">Settings</Button>
        </div>
      </header>
      <main class="flex-1 p-4">
        <RouterView />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
```

### 3. `client/src/components/AppSidebar.vue`

**Replace**: Hardcoded sample data. Wire to real `StoreContextStore` and `EntriesStore`. Remove import of `Tree.vue`. Import `PasswordTree.vue` instead. Show store name/path. Pass `entriesStore.filteredTree` and `selectedPath` to `PasswordTree`.

### 4. `client/src/components/Tree.vue`

**Delete**: No longer used. Replaced by `PasswordTree.vue`.

### 5. `client/src/stores/counter.ts`

**Delete**: Placeholder, no longer used.

### 6. `client/src/pages/index.vue`

**Delete**: Auto-router `/` page replaced by explicit routes.

### 7. `client/src/pages/about.vue` and `client/src/pages/test.vue`

**Delete**: Development artifacts.

### 8. `client/src/types/index.ts`

**Optional**: If `FileSystemTree` type is no longer referenced anywhere after `Tree.vue` deletion, it can be removed. Check first with `rg "FileSystemTree"` — if only Tree.vue used it, remove the type declaration and its export.

## Implementation Steps

### Step 1: Install missing shadcn-vue components

```bash
cd client && npx shadcn-vue add dialog card
```

### Step 2: Switch router to explicit routes

**File**: `client/src/router/index.ts`

Replace auto-routes with explicit route definitions as described in "Files to Modify" section. Add the `beforeEach` navigation guard. Remove `handleHotUpdate` and auto-routes imports. Import `useReadinessStore`, `watch` from vue.

### Step 3: Build the app shell

**File**: `client/src/App.vue`

Replace template with sidebar layout. Import shadcn-vue sidebar components, `SearchBar`, `ModeToggle`, `AppSidebar`. Wire `SearchBar` visibility to `readinessStore.isReady`.

### Step 4: Create StoreContextStore

**File**: `client/src/stores/store-context.ts`

**State**: `activeStoreName: Ref<string | null>`, `storePath: Ref<string | null>`, `gnupgHome: Ref<string | null>` — all null initially.

**Actions**:
- `refresh()`: reads from `ReadinessStore.snapshot` to populate state. If no snapshot, loads config via `ConfigService.load()` and resolves active store path.

### Step 5: Create useClipboardTimer composable

**File**: `client/src/composables/useClipboardTimer.ts`

**Logic**:
- `remaining` (ref 0), `isRunning` (ref false).
- `start(durationMs)`: set `remaining = durationMs`, `isRunning = true`, start `setInterval` decrementing by 1000. When `remaining <= 0`, call `stop()`.
- `stop()`: clear interval, set `isRunning = false`, `remaining = 0`.
- Cleanup with `onUnmounted` to clear interval.
- Use `ref` and `onUnmounted` from vue.

### Step 6: Create clipboard store

**File**: `client/src/stores/clipboard.ts`

**State**: `lastAction: Ref<ClipboardAction | null>` (null), `remainingMs: Ref<number>` (0).

**Internal**: Uses `useClipboardTimer()` composable.

**Computed**: `isActive = computed(() => lastAction.value !== null && remainingMs.value > 0)`.

**Actions**:
- `copy(path)`: get entry detail by calling `useEntriesStore().show(path)` but better to accept the secret directly to avoid re-fetching. Call `ClipboardService.write(detail.secret, path)`, store the returned `ClipboardAction`, start timer via `timer.start(action.timerSeconds * 1000)`. When timer hits 0, call `ClipboardService.clear()` automatically.
- `clear()`: call `ClipboardService.clear()`, stop timer, reset state.
- `abort()`: stop timer, reset state (no service call — clipboard retains value).

### Step 7: Create entries store

**File**: `client/src/stores/entries.ts`

**State**: `tree: Ref<EntryTree | null>`, `selectedPath: Ref<string | null>`, `selectedDetail: Ref<EntryDetail | null>`, `searchQuery: Ref<string>`, `loading: Ref<boolean>`, `error: Ref<string | null>`.

**Computed**: `filteredTree` — if `searchQuery` empty, return tree as-is. Otherwise recursively filter: keep folder if any descendant matches; keep file if name matches (case-insensitive `includes`).

**Actions**:
- `list()`: set `loading = true`, call `EntriesService.list()`, set `tree` or `error`. Set `loading = false`.
- `select(path)`: set `selectedPath`, call `EntriesService.show(path)`, set `selectedDetail`. Handle `EntryNotFoundError` by clearing detail.
- `search(query)`: set `searchQuery` (filteredTree computed updates reactively).
- `insert(input)`: call `EntriesService.insert(input)`, on success call `list()`. Return result.
- `generate(path, length?, noSymbols?)`: call `EntriesService.generate(...)`, on success call `list()`.
- `remove(path)`: call `EntriesService.remove(path)`, if `selectedPath` matches, clear detail. Call `list()`.
- `move(oldPath, newPath)`: call `EntriesService.move(...)`, on success call `list()`.

### Step 8: Build BlockedState component

**File**: `client/src/components/BlockedState.vue`

**Props**: `issue: ReadinessIssue`, `onRetry?: () => void`

**Template**: shadcn-vue Card with icon per issue code (use lucide-vue-next icons — AlertTriangle for deps, ShieldAlert for GPG, FolderX for store, AlertCircle for invalid). Issue `message` as heading, `details` as secondary text. Optional retry button.

**Mapping** (10-state model):
- `PASS_BINARY_MISSING`/`PASS_VERSION_TOO_OLD` → "Missing Dependencies" icon
- `TREE_BINARY_MISSING` → "Missing Dependencies" icon
- `GPG_BINARY_MISSING`/`GPG_NO_SECRET_KEYS` → "GPG Not Initialized" icon
- `STORE_DIR_NOT_FOUND`/`STORE_DIR_NOT_DIRECTORY` → "Store Not Found" icon
- `STORE_GPG_ID_MISSING`/`STORE_GPG_ID_EMPTY`/`STORE_GPG_ID_PARSE_ERROR`/`STORE_RECIPIENT_UNKNOWN`/`STORE_BEHAVIORAL_CHECK_FAILED` → "Store Invalid" icon

### Step 9: Build blocked page

**File**: `client/src/pages/blocked.vue`

**Template**: Centered layout with app title "pass-gui", iterate `readinessStore.issues` rendering `BlockedState` per issue, "Check Again" button that calls `readinessStore.checkReadiness()`.

**Logic**: On mount, if `snapshot` is null or older than 5 seconds, re-run `checkReadiness()`. Show `<Skeleton>` while loading. Show static recovery text per blocking state:
- `NEED_PASS`: "Install pass: `apt install pass` / `brew install pass`"
- `NEED_TREE`: "Install tree: `apt install tree` / `brew install tree`"
- `NEED_GPG`: "Install GPG: `apt install gnupg` / `brew install gnupg`"
- `GPG_NO_KEYS`: "Generate GPG keys: `gpg --full-generate-key`"
- `STORE_NOT_FOUND`: "Create a store: `pass init <your-key-id>`"
- `STORE_NO_GPG_ID`/`STORE_GPG_ID_EMPTY`: "Initialize store: `pass init <your-key-id>`"
- `STORE_GPG_ID_KEY_MISSING`: "Check `.gpg-id` and ensure recipients match keyring"
- `STORE_EMPTY`: "Store is empty — create your first entry"

### Step 10: Build SearchBar component

**File**: `client/src/components/SearchBar.vue`

**Template**: Input with search icon and clear (X) button. Import `Input` from shadcn-vue.

**Logic**: `v-model` to local `query` ref, 300ms debounce watch to call `entriesStore.search(query)`. Clear button resets query. Result count indicator (from `entriesStore.filteredTree` length).

### Step 11: Build PasswordTree component

**File**: `client/src/components/PasswordTree.vue`

**Props**: `tree: EntryNode[]`, `selectedPath: string | null`

**Emits**: `select(path: string)`

**Template**: Recursive tree: folders as shadcn-vue `Collapsible` with chevron icon, files as clickable items with `File` icon. Active file highlighted via `data-selected` attribute. Empty state message when tree is empty array.

**Logic**: Each node calls itself recursively for `children`. Click on file emits `select(path)`. Click on folder toggles collapse state.

### Step 12: Build AppSidebar

**File**: `client/src/components/AppSidebar.vue`

**Template**: Replace all hardcoded sample data. Sidebar header with store name/path from `StoreContextStore`, `PasswordTree` component wired to `entriesStore.filteredTree` and `selectedPath`, bottom section showing store path info.

**Script**: Import `useStoreContextStore` and `useEntriesStore`. Import `PasswordTree` instead of `Tree`. Remove `FileSystemTree` and the sample data.

### Step 13: Build passwords page

**File**: `client/src/pages/passwords.vue`

**Template**: Two-panel layout: left scrollable `PasswordTree`, right `EntryDetail` panel (or empty state "Select a password to view" when nothing selected).

**Script**: On mount `await entriesStore.list()`. If route has `pathMatch` param, select that entry via `entriesStore.select(pathMatch)`. Pass `entriesStore.filteredTree` and `entriesStore.selectedPath` to `PasswordTree`, handle `@select` event.

### Step 14: Build EntryDetail component

**File**: `client/src/components/EntryDetail.vue`

**Props**: `detail: EntryDetail`

**Template**: Breadcrumb path (split `detail.path` by `/`), masked password (show `••••••••` by default, toggle to reveal), copy button that calls `clipboardStore.copy(detail.path, detail.secret)`, `ClipboardIndicator`, metadata table (iterate `detail.metadata` entries), "Other fields" section for `detail.other` array, Remove button that opens `EntryRemoveDialog`.

**Script**: Import `useClipboardStore`. Compute display secret: if hidden, show `••••••••` otherwise show `detail.secret`. Toggle button changes a `showSecret` ref.

### Step 15: Build EntryRemoveDialog component

**File**: `client/src/components/EntryRemoveDialog.vue`

**Props**: `path: string`, `open: boolean`

**Emits**: `confirm`, `cancel`

**Template**: shadcn-vue `Dialog` with title "Remove Entry", entry `path` display, warning text "This action cannot be undone", confirmation checkbox ("I understand"), Cancel and Remove buttons. Remove button disabled until checkbox is checked.

### Step 16: Build EntryCreateDialog component

**File**: `client/src/components/EntryCreateDialog.vue`

**Props**: `open: boolean`

**Emits**: `close`

**Template**: `Dialog` with two tabs: Insert and Generate.

- **Insert tab**: Path input field, content textarea, Force checkbox (for overwriting existing). Submit calls `entriesStore.insert()`.
- **Generate tab**: Path input, length (number input, default 25), symbols checkbox (default true). Submit calls `entriesStore.generate()`.

**Script**: Import `useEntriesStore`. On submit, call appropriate store action. Show success/error toast. On success, emit `close` and call `entriesStore.list()`.

### Step 17: Build ClipboardIndicator component

**File**: `client/src/components/ClipboardIndicator.vue`

**Template**: Inline element next to copy button:
- idle: copy icon (from lucide-vue-next `Copy`)
- copying: spinner (`Loader2`)
- active: countdown text (e.g., "12s remaining")
- cleared: checkmark (`Check`), auto-fades after 2 seconds

**Props**: None — reads from `useClipboardStore()`. Computes state based on `clipboardStore.isActive` and `clipboardStore.remainingMs`.

### Step 18: Build settings page

**File**: `client/src/pages/settings.vue`

**Template**: Sections:
- **General**: Active store dropdown (from config `stores` keys), auto-refresh interval.
- **Generation**: Default length, symbols toggle.
- **Clipboard**: Clear timeout (seconds), selection (clipboard/primary/secondary dropdown, with note that NeutralinoJS only supports clipboard).
- **GPG Info** (read-only): GPG binary, version, home directory, secret key count.

**Logic**: On mount, load config via `ConfigService.load()`. Each section has a "Save" button that calls `ConfigService.setValue()` then `ConfigService.save()`. Active store change triggers `readinessStore.checkReadiness()` and `storeContextStore.refresh()`.

## Pinia Stores Required

### 1. `client/src/stores/readiness.ts` (created in Phase 02, no changes needed)

### 2. `client/src/stores/entries.ts`

**State shape**:
```ts
{
  tree: EntryTree | null;
  selectedPath: string | null;
  selectedDetail: EntryDetail | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
}
```

**Actions**: `list()`, `select(path)`, `search(query)`, `insert(input)`, `generate(path, length?, noSymbols?)`, `remove(path)`, `move(oldPath, newPath)`.

**Getter**: `filteredTree` — recursively filters by `searchQuery` (case-insensitive substring match on node `name`; keep folder if any descendant matches; prune empty folders).

### 3. `client/src/stores/clipboard.ts`

**State shape**:
```ts
{
  lastAction: ClipboardAction | null;
  remainingMs: number;
}
```

**Actions**: `copy(path, secret?)`, `clear()`, `abort()`.

**Getter**: `isActive = computed(() => lastAction.value !== null && remainingMs.value > 0)`.

**Timer**: Uses `useClipboardTimer()` composable internally. On `copy()`, timer starts with `action.timerSeconds * 1000`. Watch composable's `remaining` to update `remainingMs`. At 0, call `ClipboardService.clear()`.

### 4. `client/src/stores/store-context.ts`

**State shape**:
```ts
{
  activeStoreName: string | null;
  storePath: string | null;
  gnupgHome: string | null;
}
```

**Actions**: `refresh()` — reads from `ReadinessStore.snapshot` or `ConfigService.load()` to populate state.

## Integration Points

This phase produces the complete frontend that connects to all previous phases:

1. **App shell + router**: Consumes `ReadinessStore` from Phase 02 for guarded navigation.
2. **Blocked screen**: Consumes `ReadinessStore.issues` from Phase 02, renders one `BlockedState` per issue.
3. **Password list**: Consumes `EntriesService` from Phase 03 via `EntriesStore`.
4. **Entry detail**: Consumes `EntryDetail` type from Phase 03.
5. **Clipboard**: Consumes `ClipboardService.write/clear` from Phase 03 via `ClipboardStore`. Timer logic is in `ClipboardStore` (not the service).
6. **Mutations**: Consumes `EntriesService.insert/generate/remove/move` from Phase 03.
7. **Settings**: Consumes `ConfigService` from Phase 01, `ReadinessStore` from Phase 02.

Phase 05 (release) depends on all UI flows being functional from this phase.

## Verification Checklist

- [ ] shadcn-vue dialog and card components installed (check `client/src/components/ui/dialog/` and `card/`)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format` all pass
- [ ] `pnpm dev` starts without errors
- [ ] App opens to readiness check → shows password list when ready
- [ ] When `pass` is missing, app shows blocked screen with `DEPENDENCIES_MISSING` and actionable guidance
- [ ] When GPG has no keys, app shows `GPG_NOT_INITIALIZED` with guidance and retry button
- [ ] When store path does not exist, app shows `STORE_NOT_FOUND` with guidance
- [ ] When store is invalid, app shows `STORE_INVALID` with specific issues listed
- [ ] Password list shows entries from the active store with folder structure
- [ ] Empty store shows "No passwords yet" (not an error)
- [ ] Clicking a file in the tree selects it and shows detail panel on the right
- [ ] Detail panel shows masked password (••••••••), toggle reveals it
- [ ] Copy button writes to clipboard and shows countdown indicator
- [ ] Timer counts down in clipboard indicator; clipboard auto-clears at 0
- [ ] Manual clear button aborts timer immediately
- [ ] Create dialog (insert mode) creates entry visible in tree on close
- [ ] Create dialog (generate mode) creates entry and shows generated password length
- [ ] Remove dialog requires confirmation checkbox before removing
- [ ] Search filters the tree in real time with debounce (300ms)
- [ ] Search clear button resets filter
- [ ] Settings page shows all config sections (general, generation, clipboard, GPG)
- [ ] Changing and saving a config value persists on app reload
- [ ] Switching active store re-triggers readiness check
- [ ] Dark/light mode toggle works on all screens
- [ ] Sidebar collapses/expands correctly with shadcn-vue sidebar trigger
- [ ] Deeply nested folders (3+ levels) display and navigate correctly
- [ ] Entry paths with spaces and special characters render correctly
- [ ] Removing an entry clears the detail panel and updates the tree
- [ ] Old `counter.ts` store is deleted
- [ ] Old `Tree.vue` component is deleted
- [ ] Old `about.vue`, `test.vue`, `index.vue` pages are deleted
- [ ] Router uses explicit routes (no auto-routes import)
- [ ] Navigation guard correctly redirects based on readiness state
- [ ] `/settings` is always accessible regardless of readiness state
- [ ] Direct navigation to `/passwords` when not ready redirects to `/blocked`
