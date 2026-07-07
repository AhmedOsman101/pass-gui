# Frontend Phase 04 — Quest Chain

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Progress

- [x] Quest 1: The State Layer
- [x] Quest 2: The Readiness Gate
- [x] Quest 3: The Entry Tree
- [x] Quest 4: The Entry Detail
- [x] Quest 5: The Clipboard Ritual
- [x] Quest 6: The Mutation Flows
- [x] Quest 7: The Ledger Reconciliation

**Goal:** Build the frontend UI that consumes Phase 02/03 backend contracts — readiness state machine, entry operations, clipboard — and delivers an end-to-end user journey: open app, understand readiness, view entries, inspect a entry, copy a value, perform mutations.

**Tech Stack:** Vue 3.5 (setup script), Pinia 3, TypeScript 5.9, TailwindCSS 4, shadcn-vue 2, lib-result 5, NeutralinoJS 6.4.

## Deviations from Actual Codebase

- **Quest 2b (App.vue)**: Plan says replace App.vue with sidebar layout. Actual App.vue remained thin — `ReadinessGate > RouterView + ClipboardToast`. The sidebar layout lives in `pages/index.vue` instead.
- **Quest 3 (Entry Tree)**: Plan references `EntryTree.vue` component. Actual implementation uses `Tree.vue` (flat renderer with `TransitionGroup`, keyboard nav, context menus, cut-dim/copy-pulse) driven by `useTreeState` composable — not the recursive pattern described.
- **Quest 1b (active-store)**: Named `useActiveStoreStore` (not `useStoreContextStore` as sometimes referenced in other plans). Includes `currentStoreConfig` and `getGpgHome()` beyond the spec.
- **Search**: Inlined in `AppSidebar.vue` with 300ms debounce via `@vueuse/core` — no separate `SearchBar.vue` component.
- **Clipboard timer**: Inlined in `clipboard.ts` store with drift correction — no separate `useClipboardTimer` composable.

---

## The World

Phase 02 gave us a readiness state machine (`Readiness.check()`) that tells us _whether_ the app can operate. Phase 03 gave us `Entries` (list/show/insert/generate/remove/move/edit), `Clipboard` (write/clear), `walkStore`, and `parsePassShowOutput`. All return `Result` types. All error classes are defined.

The frontend has nothing. `App.vue` is a logo + `<RouterView>`. `pages/index.vue` is a link to a test page. `stores/counter.ts` is a Vite scaffold. The sidebar component has hardcoded sample data.

Phase 04 wires the backend to the UI. The architecture is simple: **view -> store -> service -> result -> UI state**. Pinia stores call services, services return `Result`, stores map results to reactive state, views render that state. No business logic in components. No service calls in components.

**Design direction:** A password manager is a trust exercise. The UI must feel secure, deliberate, and calm. Dark mode primary. Monospace for secrets. Muted palette — the content is the security, not decorative flourishes. Sidebar for navigation, main panel for detail. Clear state transitions: loading -> blocked -> ready. Actionable errors with recovery guidance, never raw command failures.

---

## The Pipeline

Execution order matters. Stores first (they're the contract), then readiness (the gate), then the main flow (tree -> detail -> clipboard -> mutations).

|  #  | Quest                     | What it builds                                           | Depends on |
| :-: | ------------------------- | -------------------------------------------------------- | ---------- |
|  1  | The State Layer           | Pinia stores: readiness, activeStore, entries, clipboard | —          |
|  2  | The Readiness Gate        | Readiness screens, blocked states, recovery guidance     | Quest 1    |
|  3  | The Entry Tree            | Sidebar entry listing, store-aware navigation            | Quest 1    |
|  4  | The Entry Detail          | Detail view, metadata display, secret masking            | Quest 1, 3 |
|  5  | The Clipboard Ritual      | Copy flow, auto-clear timer, toast feedback              | Quest 1    |
|  6  | The Mutation Flows        | Insert, generate, remove, move UI flows                  | Quest 1, 3 |
|  7  | The Ledger Reconciliation | Wire into TODO.md, verify end-to-end                     | Quest 1-6  |

---

## Quest Chain

Complete these in order. Each quest unlocks the next.

---

### Quest 1: The State Layer

**Reward:** Pinia stores that consume backend services and expose reactive state to views.

Create four stores. Each store calls a service, handles the `Result`, and maps to reactive state. No component logic, no business rules.

#### 1a. `client/src/stores/readiness.ts` — Readiness Store

**State:**

- `snapshot: Ref<ReadinessSnapshot | null>` — the latest readiness evaluation
- `isEvaluating: Ref<boolean>` — true while `Readiness.check()` is running
- `error: Ref<string | null>` — if the check itself fails (network, NeutralinoJS crash)

**Computed:**

- `state: ComputedRef<ReadinessState>` — `snapshot?.state ?? "NEED_PASS"` (default to most blocking)
- `isReady: ComputedRef<boolean>` — `state.value === "READY"`
- `blockingIssues: ComputedRef<ReadinessIssue[]>` — `snapshot?.issues.filter(i => i.severity === "blocking") ?? []`
- `infoIssues: ComputedRef<ReadinessIssue[]>` — `snapshot?.issues.filter(i => i.severity === "info") ?? []`

**Actions:**

- `evaluate(storePath: string): Promise<void>` — calls `Readiness.check(storePath)`, sets `snapshot`, handles errors
- `reset(): void` — clears snapshot (used on store switch)

**Why this matters:** Every view reads from this store to decide what to render. The readiness state machine is the app's entry point — if this store is wrong, everything downstream is wrong.

#### 1b. `client/src/stores/active-store.ts` — Active Store Store

**State:**

- `storePath: Ref<string | null>` — the resolved absolute path of the active store
- `storeName: Ref<string | null>` — the config key (e.g. "default")
- `isValidating: Ref<boolean>` — true while validating

**Computed:**

- `hasStore: ComputedRef<boolean>` — `storePath.value !== null`
- `storeConfig: ComputedRef<StoreConfig | null>` — reads from `Config` to get the current store's config

**Actions:**

- `load(): Promise<void>` — reads `Config.getValue("core", "active_store")`, resolves the path via `Pass.storeDirectory`, sets state
- `switchTo(storeName: string): Promise<void>` — updates config, calls `Pass.setStorePath()`, re-evaluates readiness
- `getGpgHome(): string | undefined` — returns the current store's `gnupg_home` from config

**Why this matters:** The active store determines which `PASSWORD_STORE_DIR` and `GNUPGHOME` are in effect. Every entry operation depends on this store being correct.

#### 1c. `client/src/stores/entries.ts` — Entries Store

**State:**

- `tree: Ref<EntryTree>` — the full entry tree from `walkStore`
- `currentPath: Ref<string | null>` — the currently selected entry path
- `currentEntry: Ref<EntryDetail | null>` — the loaded entry detail
- `isLoadingTree: Ref<boolean>` — true while listing
- `isLoadingEntry: Ref<boolean>` — true while showing
- `searchQuery: Ref<string>` — filter text for the tree
- `error: Ref<string | null>` — last error message

**Computed:**

- `filteredTree: ComputedRef<EntryTree>` — filters `tree` by `searchQuery` (case-insensitive match on `name` and `path`)
- `hasEntries: ComputedRef<boolean>` — `tree.value.length > 0`

**Actions:**

- `loadTree(): Promise<void>` — calls `Entries.list()`, maps result to `tree`
- `selectEntry(path: string): Promise<void>` — sets `currentPath`, calls `Entries.show(path)`, maps to `currentEntry`
- `clearSelection(): void` — resets `currentPath` and `currentEntry`
- `refresh(): Promise<void>` — reloads tree (re-reads filesystem)

**Why this matters:** The entry tree is the primary data the UI displays. This store is the single source of truth for what entries exist and which one is selected.

#### 1d. `client/src/stores/clipboard.ts` — Clipboard Store

**State:**

- `lastAction: Ref<ClipboardAction | null>` — the last copy action
- `remainingMs: Ref<number>` — milliseconds until auto-clear
- `timerId: Ref<ReturnType<typeof setTimeout> | null>` — the active timer
- `isCopied: Ref<boolean>` — true while within the copy window

**Computed:**

- `isActive: ComputedRef<boolean>` — `isCopied.value && remainingMs.value > 0`
- `formattedRemaining: ComputedRef<string>` — human-readable countdown (e.g. "32s")

**Actions:**

- `copy(secret: string, entryPath: string): Promise<void>` — calls `Clipboard.writeText()`, starts countdown timer, sets `lastAction`
- `clear(): Promise<void>` — calls `Clipboard.clear()`, stops timer, resets state
- `startTimer(expiresAt: number): void` — calculates remaining, starts `setTimeout` that calls `clear()` when fired
- `stopTimer(): void` — clears timeout, resets state

**Why this matters:** Clipboard is the most security-sensitive UI flow. The timer must be precise, the clear must be unconditional, and the UI must show the countdown so the user knows when the secret expires.

**Verify:** `pnpm typecheck` passes. All four stores are importable. No service calls in components — only in stores.

---

### Quest 2: The Readiness Gate

**Reward:** The app shows the correct screen based on readiness state, with actionable recovery guidance.

This quest replaces the current `App.vue` (logo + RouterView) with a readiness-driven shell. The app evaluates readiness on mount, then renders either a blocked screen or the main app layout.

#### 2a. Readiness Screen Components

Create `client/src/components/readiness/` directory with:

- **`ReadinessGate.vue`** — the shell component. On mount, calls `readinessStore.evaluate()`. Renders:
  - `LoadingScreen` while `isEvaluating` is true
  - `BlockedScreen` with the first blocking issue when state is not `READY`
  - `<RouterView>` when state is `READY`

- **`LoadingScreen.vue`** — skeleton/spinner while readiness checks run. Shows "Checking dependencies..." text. Uses the existing `skeleton` shadcn component.

- **`BlockedScreen.vue`** — displays the blocking issue with recovery guidance. Props: `issue: ReadinessIssue`. Maps issue codes to human-readable titles and actions:
  - `PASS_BINARY_MISSING` -> "pass not found" + install instructions
  - `GPG_BINARY_MISSING` -> "GPG not found" + install instructions
  - `GPG_NO_SECRET_KEYS` -> "No GPG keys" + key generation guidance
  - `STORE_DIR_NOT_FOUND` -> "Store not found" + path shown, create/locate action
  - `STORE_GPG_ID_MISSING` -> "Store not initialized" + `pass init` guidance
  - `STORE_RECIPIENT_UNKNOWN` -> "Unknown key in .gpg-id" + key import guidance
  - `STORE_EMPTY` -> "Store is empty" + info severity (not blocking, but shown)
  - Fallback: generic "Something went wrong" + raw issue code for debugging

- **`IssueCard.vue`** — reusable card for displaying a single issue. Props: `code`, `severity`, optional context fields. Shows icon (alert triangle for blocking, info for info), title, description, and action button if applicable.

#### 2b. Update `App.vue`

Replace the current logo + RouterView with:

```
<ReadinessGate>
  <AppSidebar />
  <RouterView />
</ReadinessGate>
```

The `ReadinessGate` wraps everything — if readiness fails, nothing else renders.

#### 2c. Update `pages/index.vue`

Replace the test link with the main app layout: sidebar + content area. The sidebar shows the entry tree (Quest 3 fills this in). The content area shows either the entry detail (Quest 4) or a welcome/empty state.

**Verify:** `pnpm typecheck` passes. App renders loading screen, then blocked screen (if dependencies missing), or main layout (if ready). Each blocked state shows the correct recovery guidance.

---

### Quest 3: The Entry Tree

**Reward:** A sidebar that lists all entries in the active store, with search filtering and click-to-select.

#### 3a. Entry Tree Component

Create `client/src/components/EntryTree.vue`.

**Props:** none (reads from `entriesStore`).

**Behavior:**

- On mount (or when `activeStore.hasStore` becomes true), calls `entriesStore.loadTree()`
- Renders the tree recursively using the existing `Tree.vue` component pattern (or a new recursive component)
- Each entry node shows:
  - Directory: folder icon + name, collapsible
  - File: file icon + name (without `.gpg` extension, already stripped by `walkStore`)
- Click on a file -> calls `entriesStore.selectEntry(path)`
- Selected entry gets a visual highlight (active state)
- Search input at the top of the sidebar filters the tree in real-time

#### 3b. Integrate into AppSidebar

Replace the hardcoded sample data in `AppSidebar.vue` with `EntryTree`. The sidebar now shows real entries from the active store.

#### 3c. Empty State

When `entriesStore.hasEntries` is false (empty store), show a message: "No entries yet. Create your first password entry." with a button that triggers the insert flow (Quest 6).

**Verify:** `pnpm typecheck` passes. Sidebar shows real entries from the password store. Clicking an entry selects it. Search filters the tree. Empty store shows helpful message.

---

### Quest 4: The Entry Detail

**Reward:** A detail panel that shows the selected entry's secret, metadata, and actions.

#### 4a. Entry Detail Component

Create `client/src/components/EntryDetail.vue`.

**Props:** none (reads from `entriesStore.currentEntry`).

**Layout:**

- **Header:** entry path (e.g. `Email/work`), with breadcrumb navigation
- **Secret field:** monospace, masked by default (dots), click-to-reveal toggle, copy button
- **Metadata table:** key-value pairs from `EntryDetail.metadata`, each row with label + value + copy button
- **Other lines:** any non-metadata lines shown as plain text
- **Actions bar:** Copy password, Edit, Move, Delete (icons with tooltips)

#### 4b. Secret Masking

- Default state: show `- - - - - - - - - - ` (10 dots)
- Click eye icon -> reveal secret in monospace
- Click again -> re-mask
- The secret is never logged, never stored in localStorage, only held in the Pinia store's reactive state

#### 4c. Metadata Display

- Render `EntryDetail.metadata` as a definition list or table
- Each key is a label, each value is copyable
- Common keys get friendly labels: `username` -> "Username", `URL` -> "Website", `otp` -> "OTP Secret"

#### 4d. Empty/Loading States

- While `isLoadingEntry` is true -> skeleton placeholder
- When `currentEntry` is null -> "Select an entry from the sidebar"
- When entry has no metadata -> "No additional metadata"

**Verify:** `pnpm typecheck` passes. Selecting an entry shows its detail. Secret is masked by default. Metadata is displayed. Copy buttons work (triggers Quest 5 clipboard flow).

---

### Quest 5: The Clipboard Ritual

**Reward:** Copy-to-clipboard with auto-clear timer and visual feedback.

#### 5a. Clipboard Toast/Feedback

Create `client/src/components/ClipboardToast.vue`.

**Behavior:**

- When `clipboardStore.isActive` is true, show a persistent toast/banner at the bottom of the screen
- Shows: "Password copied. Clears in {countdown}s."
- Countdown updates every second via `clipboardStore.formattedRemaining`
- When timer fires -> toast disappears, clipboard is cleared
- Manual "Clear now" button in the toast

#### 5b. Copy Button Integration

- The copy button in `EntryDetail.vue` calls `clipboardStore.copy(secret, entryPath)`
- The copy button in the metadata table calls `clipboardStore.copy(value, entryPath)`
- After copy -> button shows checkmark for 2 seconds -> reverts

#### 5c. Timer Precision

- The timer uses `setTimeout` with drift correction: calculate remaining from `expiresAt - Date.now()` on each tick, not by decrementing a counter
- If the app is backgrounded and `setTimeout` fires late, the clear still happens immediately

**Verify:** `pnpm typecheck` passes. Copying a password shows the toast with countdown. Timer fires and clears clipboard. "Clear now" works. Toast disappears after clear.

---

### Quest 6: The Mutation Flows

**Reward:** UI flows for inserting, generating, removing, and moving entries.

#### 6a. Insert Entry Dialog

Create `client/src/components/InsertEntryDialog.vue`.

**Behavior:**

- Triggered from empty state message or "+" button in sidebar
- Dialog with: path input (store-relative, e.g. `Email/work`), content textarea
- Submit calls `Entries.insert()`, on success refreshes tree and selects the new entry
- Shows error if entry already exists (from `EntryAlreadyExistsError`)

#### 6b. Generate Password Dialog

Create `client/src/components/GenerateDialog.vue`.

**Behavior:**

- Triggered from "Generate" button (in sidebar or detail view)
- Options: memorable toggle, length slider (8-64), symbols toggle
- Submit calls `Entries.generate()`, on success refreshes tree and selects the new entry
- Shows generated password briefly before masking

#### 6c. Delete Confirmation

Create `client/src/components/DeleteConfirmDialog.vue`.

**Behavior:**

- Triggered from delete button in entry detail
- Shows entry path and asks "Delete {path}? This cannot be undone."
- Submit calls `Entries.remove()`, on success refreshes tree and clears selection
- Uses shadcn `AlertDialog` pattern (confirm/cancel)

#### 6d. Move/Rename Dialog

Create `client/src/components/MoveEntryDialog.vue`.

**Behavior:**

- Triggered from move button in entry detail
- Shows current path, input for new path
- Submit calls `Entries.move()`, on success refreshes tree and selects the entry at new path

**Verify:** `pnpm typecheck` passes. All four mutation flows work end-to-end. Tree refreshes after each mutation. Errors are shown in the UI, not thrown.

---

### Quest 7: The Ledger Reconciliation

**Reward:** Everything wired together, TODO updated, ready for Phase 05.

1. Update `TODO.md`:
   - Section 5 (Listing): check off items now implemented via entry tree
   - Check off readiness-driven UI items
   - Leave unchecked: settings UI (future), search/filter (future), QR code (future)

2. Run `pnpm typecheck && pnpm lint && pnpm format` — must pass clean.

3. Verify end-to-end flow:
   - App opens -> loading screen -> readiness check -> blocked or ready
   - Ready -> sidebar shows entries -> click entry -> detail view
   - Copy password -> toast with countdown -> auto-clear
   - Insert/generate -> tree refreshes -> new entry appears
   - Delete -> confirmation -> entry removed
   - Move -> new path -> entry relocated

4. Verify no raw throws escape from any component — all errors are caught by stores and displayed in UI.

5. Verify secret is never logged, never in localStorage, only in Pinia reactive state.

---

## Verification

After all quests are complete:

1. `pnpm typecheck` — zero errors.
2. `pnpm lint && pnpm format` — zero issues.
3. App renders readiness loading -> blocked/ready transition.
4. Sidebar lists entries from the active store.
5. Entry detail shows secret (masked), metadata, and actions.
6. Copy-to-clipboard works with auto-clear timer.
7. Insert, generate, remove, move all work end-to-end.
8. Empty store shows helpful guidance.
9. All errors are displayed in UI, never thrown to console.

---

## What Phase 05 Gets

This phase produces:

- **Stores:** `readiness`, `activeStore`, `entries`, `clipboard`
- **Views:** readiness gate (loading/blocked/ready), main layout (sidebar + detail)
- **Components:** `ReadinessGate`, `BlockedScreen`, `IssueCard`, `EntryTree`, `EntryDetail`, `ClipboardToast`, `InsertEntryDialog`, `GenerateDialog`, `DeleteConfirmDialog`, `MoveEntryDialog`
- **Flows:** entry listing, detail view, copy-to-clipboard, insert, generate, delete, move

Phase 05 (release and future work) builds on this: settings UI, search/filter, QR code, multi-store switching, filesystem watching.

---

## Design Notes

### Visual Direction

- **Dark mode primary** — slate/zinc palette, not pure black. Trustworthy, not harsh.
- **Monospace for secrets** — `font-mono` on all secret/password fields. The content is the security.
- **Muted accents** — single accent color (e.g. blue-500) for interactive elements. Not loud.
- **Sidebar layout** — collapsible sidebar for entry tree, main panel for detail. The sidebar is the primary navigation.
- **Clear state transitions** — loading -> blocked -> ready. No clever animations, no ambiguity.
- **Actionable errors** — every blocked state has a title, description, and next step. Never raw error codes.

### Component Patterns

- All components use `<script setup lang="ts">`
- Props defined with `defineProps<{ ... }>()` (runtime options)
- Emits defined with `defineEmits<{ ... }>()`
- No service calls in components — only stores
- No business logic in components — only rendering
- TailwindCSS for all styling — no CSS files
- shadcn-vue for UI primitives (Button, Input, Dialog, AlertDialog, Toast, Skeleton)

### File Naming

- Stores: `client/src/stores/{name}.ts` (camelCase)
- Components: `client/src/components/{Name}.vue` (PascalCase)
- Views/pages: `client/src/pages/{name}.vue` (kebab-case, auto-routed)
