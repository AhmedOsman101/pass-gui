# Task 1: Component Test Scope Report

## Files Changed
- `.scratch/test-strategy/issues/03-define-component-test-scope.md` — replaced with comprehensive scoped list
- `.scratch/test-strategy/map.md` — added resolved entry under "Decisions so far"
- `.scratch/test-strategy/reports/task-1-report.md` — this file

## Full .vue File Inventory (LOC)

### Components/ (36 files, 4493 LOC total)

| File | LOC | Category |
|---|---|---|
| `EntryForm.vue` | 330 | **TEST** (core) |
| `Tree.vue` | 271 | **TEST** (core) |
| `AppSidebar.vue` | 247 | **TEST** (core) |
| `EntryDetail.vue` | 299 | **TEST** (core) |
| `PasswordGenerator.vue` | 76 | exempt (dialog passthrough, trivial logic) |
| `GeneratorOptionsPanel.vue` | 96 | exempt (pure binding to composable) |
| `GenerateDialog.vue` | 128 | borderline (validation + store call — lightweight pure-function test optional) |
| `CreateFolderDialog.vue` | 102 | **lightweight test** (form validation + buildFullPath logic) |
| `DeleteConfirmDialog.vue` | 61 | exempt (trivial 1-action passthrough) |
| `RenameEntryDialog.vue` | 135 | **lightweight test** (path parsing + validation + same-name check) |
| `EditEntryDialog.vue` | 105 | exempt (trivial validation + store passthrough) |
| `InsertDialog.vue` | 148 | exempt (trivial validation + store passthrough) |
| `MoveOrDuplicateDialog.vue` | 238 | **lightweight test** (mode logic + folder creation + buildFullDestination) |
| `StoreDeleteDialog.vue` | 56 | exempt (pure emit passthrough) |
| `ModeToggle.vue` | 36 | exempt (trivial useColorMode wrapper) |
| `DirectoryTree.vue` | 63 | exempt (small recursive, trivial expand/collapse) |
| `settings/AddStoreWizard.vue` | 370 | **TEST** (core) |
| `settings/GpgTab.vue` | 270 | **TEST** (core) |
| `settings/StoresTab.vue` | 308 | **TEST** (core) |
| `settings/ClipboardTab.vue` | 92 | exempt (pure model binding) |
| `settings/ExtensionsTab.vue` | 37 | exempt (pure model binding) |
| `settings/GenerationTab.vue` | 139 | exempt (pure model binding, conditional render) |
| `settings/InfoTab.vue` | 201 | exempt (display-only, copy buttons use navigator.clipboard — not available in Neu context) |
| `settings/PreferencesTab.vue` | 41 | exempt (pure model binding) |
| `readiness/ReadinessGate.vue` | 44 | exempt (lifecycle orchestration, tested at integration level) |
| `readiness/BlockedScreen.vue` | 51 | exempt (thin store passthrough) |
| `readiness/IssueCard.vue` | 126 | exempt (display mapping — pure function extractable if desired, component itself trivial) |
| `readiness/LoadingScreen.vue` | 13 | exempt (skeleton) |
| `icons/Icon*.vue` | 5×12L | exempt (pure SVG stubs) |

### Pages/ (3 files, 343 LOC total)

| File | LOC | Category |
|---|---|---|
| `index.vue` | 28 | exempt (layout wiring) |
| `settings.vue` | 285 | exempt (page-level config orchestration — tested at integration level) |
| `test.vue` | 30 | exempt (dev scaffold) |

## Per-Component Analysis: 7 Core Components

### 1. EntryForm (330 LOC)

**Purpose:** Create or edit a password entry. Multi-field form with path, secret, metadata.

**Non-trivial behaviors:**
- Form validation (path required, secret required, duplicate metadata keys)
- Mode switching (create vs edit) — different initialization, path disabled on edit
- Password auto-generation on create mode (watches formMode)
- Secret visibility toggle
- Metadata add/remove with duplicate key detection (`duplicateKeys` computed)
- `buildContent()` — assembles pass entry format (secret line 1, key: value lines)
- `handleSubmit()` — dispatches to `treeStore.editEntry` or `treeStore.insertEntry`
- Error display from store responses
- Integration with EntryForm store and password generator composable

**What to test:**
- `handleSubmit` validation: empty path → "Path is required", empty secret → "Password is required", duplicate metadata keys → error message with key names
- `handleSubmit` success: calls `treeStore.insertEntry` in create mode, `treeStore.editEntry` in edit mode
- `handleSubmit` error: displays error string returned from store
- `buildContent()`: single secret → just secret; secret + metadata → "secret\nkey: value"
- `duplicateKeys` computed: detects when multiple metadata entries share the same key
- Mode watcher: path initialized from `currentEntry.path` in edit mode, blank in create
- Secret visibility: `isSecretVisible` toggles on button click
- Password auto-gen: `genOptions.generated` applied to secret on create mode

**What NOT to test:**
- shadcn-vue Button/Input wrappers
- Template rendering structure
- CSS/animations

**Test pattern:**
```
mount(EntryForm, {
  global: { plugins: [createPinia()] }
})
// mock entryTreeStore.insertEntry/editEntry via vi.mock
// set formStore.formMode, treeStore.currentEntry
// assert validation errors, call submit, assert store calls
```

---

### 2. Tree (271 LOC)

**Purpose:** Renders the entry tree with keyboard navigation, context menus, clipboard operations.

**Non-trivial behaviors:**
- `useTreeState` composable integration: visibleNodes, focusedPath, selectedPath, navigation (focusNext/Prev, arrowRight/Left, toggleDir, toggleSelect)
- Hotkey handlers via `useHotkey`: F2 (rename), Delete, ArrowDown/Up/Right/Left, Enter
- Context menu: rename, delete, create folder, copy/cut/paste per node type
- Clipboard buffer integration: `isCutDimmed`, `hasCopyBuffer`, `copyEntry`, `cutEntry`, `pasteEntry`
- Dialog open/close state management for rename, delete, create-folder sub-dialogs
- `isSearchMatch` — checks if path matches search query (case-insensitive contains)
- `nodeName()`, `dirPath()` path parsing utilities
- Search filtering via `searchQuery` prop → composed into `useTreeState`

**What to test:**
- Hotkey F2 → opens rename dialog for selected node (sets `isRenameOpen`, `renamePath`)
- Hotkey Delete → opens delete dialog for selected node
- ArrowUp/ArrowDown trigger `focusPrev`/`focusNext` on useTreeState
- `openRename`/`openDelete`/`openCreateFolder` set correct state
- `isCutDimmed` returns true when path matches cut buffer
- `hasCopyBuffer` returns true when path matches any buffer
- `isSearchMatch` returns true when query substring-matches path (case-insensitive)
- `nodeName` extracts final path segment
- `dirPath` extracts parent directory

**What NOT to test:**
- TransitionGroup animations
- shadcn-vue SidebarMenuButton/ContextMenu/SidebarMenuItem wrappers
- useTreeState internals (tested via its own unit tests)

**Test pattern:**
```
mount(Tree, {
  global: { plugins: [createPinia()] },
  props: { searchQuery: "" }
})
// mock entryTreeStore.visibleNodes, selectedPath, currentPath
// trigger hotkeys, assert dialog state refs
// pass searchQuery prop, assert isSearchMatch
```

---

### 3. AppSidebar (247 LOC)

**Purpose:** Sidebar with search, sort, store watcher, global hotkeys, new/generate buttons.

**Non-trivial behaviors:**
- Search with 300ms debounce via `refDebounced`
- Store watcher: interval-based polling every 2s via `Watcher.hasChanged` → `treeStore.refresh()`
- Global hotkeys: Mod+C (copy), Mod+X (cut), Mod+V (paste) with `findNode` recursive traversal
- `findNode()` recursive tree search
- Sort mode dropdown (A-Z, Z-A) triggers `treeStore.setSortMode`
- Watches `activeStore.hasStore` → `treeStore.loadTree()`
- Watches `Pass.storeDirectory` → starts watcher
- `onUnmounted` cleanup: clears interval, unwatches Watcher
- Context menu: New Entry, New Folder

**What to test:**
- Search: `searchQuery` updates, `debouncedSearch` value is 300ms delayed
- Store watcher start: `Watcher.watch` called with correct args
- Store watcher interval: `treeStore.refresh` called when `Watcher.hasChanged` returns true
- Store watcher cleanup: interval cleared and `Watcher.unwatch` called on unmount
- Hotkey Mod+C: calls `clipboard.copyEntry` with current path and node type
- Hotkey Mod+X: calls `clipboard.cutEntry` with current path and node type
- Hotkey Mod+V: pastes into current directory or root
- `findNode`: finds node by path in nested tree
- Sort mode click: calls `treeStore.setSortMode` with correct value
- Watch `activeStore.hasStore` → `treeStore.loadTree()`

**What NOT to test:**
- shadcn-vue Sidebar/DropdownMenu/ContextMenu wrappers
- Button styling

**Test pattern:**
```
mount(AppSidebar, {
  global: { plugins: [createPinia()] }
})
// mock activeStore, treeStore, clipboard, Watcher, Pass
// simulate hotkey events, assert store/dispatch calls
// mount/unmount to test watcher lifecycle
```

---

### 4. AddStoreWizard (370 LOC)

**Purpose:** Multi-step wizard for adding or creating a password store.

**Non-trivial behaviors:**
- Multi-step state machine: `name → path → gpg → creating` with back navigation
- Name validation: empty check, duplicate name, invalid chars (`/^[a-zA-Z0-9_-]+$/`)
- Path validation: empty, duplicate path across stores
- Step advancement computed guards: `canAdvanceName`, `canAdvancePath`, `canCreate`
- GPG key loading via `Gpg.listSecretKeys()` on dialog open
- Folder picker via `NeuDialog.showFolderDialog()`
- Existing store detection via `StoreValidation.validate()`
- `createStore()` orchestration: (1) mkdir if new, (2) pass init if new, (3) restore previous path, (4) load config, (5) update stores, (6) save config, (7) emit created
- Error handling at each step of createStore with rollback step navigation
- Wizard reset on dialog close
- `keyLabel()` formatting for GPG keys

**What to test:**
- Name validation: empty → "Path is required", duplicate name → "A store with this name already exists", invalid chars → "Name can only contain letters..."
- Path validation: empty → no error (not blocking), duplicate path → "A store with this path already exists"
- Step advancement: `advanceStep` moves name→path→gpg when guards pass
- Step back: `goBack` moves gpg→path→name
- `createStore` full flow: mkdir → pass init → config update → emit "created"
- `createStore` errors: mkdir failure, pass init failure, config save failure all set `creationError` and return to gpg step
- Existing store detection: skips mkdir and pass init, just adds to config
- `loadKeys` on dialog open calls `Gpg.listSecretKeys()`
- Wizard reset clears all state

**What NOT to test:**
- shadcn-vue Dialog/Select/Badge/Input wrappers

**Test pattern:**
```
mount(AddStoreWizard, {
  global: { plugins: [createPinia()] },
  props: { stores: {}, activeStore: "default", open: true }
})
// mock Gpg, NeuDialog, Pass, Config, Fs, StoreValidation at module level
// set storeName/path values, advance steps
// call createStore, assert sequence of service calls and emits
```

---

### 5. GpgTab (270 LOC)

**Purpose:** GPG settings — extra options tags, signing key, recipient key.

**Non-trivial behaviors:**
- Tag input with add (Enter/comma), remove (X button, Backspace), inline edit (click to edit, Enter/blur to commit, Escape to cancel)
- Comma-separated tag paste support
- Duplicate tag prevention on add
- Signing key mode switching: select list, custom (free text), none
- Recipient key mode switching: select list, custom, none
- GPG key loading via `Gpg.listSecretKeys()` on mount
- `handleSigningKeyChange` / `handleRecipientKeyChange` parse `__custom__`, `__none__`, or real key ID
- `keyLabel()` helper: "name (shortid)"

**What to test:**
- Tag add: single tag, comma-separated multiple, duplicate prevention, empty string skipped
- Tag remove by index via `removeTag`
- Tag inline edit: `startEditTag` sets state, `commitEditTag` updates array, `cancelEditTag` resets
- Tag keyboard: Enter/comma calls addTag, Backspace on empty removes last
- Signing key mode: `"__custom__"` → switch to custom input, `"__none__"` → clear and return to select mode, real key ID → set value
- Recipient key mode: same behavior as signing key
- `keyLabel` formats correctly

**What NOT to test:**
- shadcn-vue Card/Select/Button wrappers
- GPG service internals (tested separately)

**Test pattern:**
```
mount(GpgTab, {
  global: { plugins: [createPinia()] },
  props: { opts: [], signingKey: "", recipientKey: "", isSaving: false }
})
// mock Gpg service at module level
// simulate tag input, assert opts array changes
// simulate select changes, assert signingKey/recipientKey model updates
```

---

### 6. StoresTab (308 LOC)

**Purpose:** Store management — active store selector, inline store editing, delete.

**Non-trivial behaviors:**
- `storeEntries` computed: active store sorted first, then alphabetical by name
- Inline store editing: edit form with path and gnupg_home fields, folder picker buttons
- `findStoreByPath()` + `isPathUnique()` for path collision detection
- `saveEditStore()`: validates path non-empty, checks uniqueness, emits `updateStores` + `save`
- `confirmDeleteStore()`: removes from stores object, emits save
- `promptDeleteStore()`: sets delete target, opens dialog
- Active store selector dropdown
- AddStoreWizard integration
- `handleStoreCreated()` delegates to save

**What to test:**
- `storeEntries` sorting: active store is first element, remainder alphabetical
- `isPathUnique`: returns false when path exists under different name, true when same name or unique
- `saveEditStore`: empty path guard, duplicate path guard, emits correct payload
- `saveEditStore`: sets `gnupg_home` from form, omits if empty
- `confirmDeleteStore`: removes store from object, emits save
- `startEditStore`: initializes form with correct store data
- `findStoreByPath`: finds store name from path

**What NOT to test:**
- shadcn-vue Card/Select/Button wrappers
- AddStoreWizard internals (tested separately)

**Test pattern:**
```
mount(StoresTab, {
  global: { plugins: [createPinia()] },
  props: {
    stores: { default: { path: "/a" }, work: { path: "/b" } },
    activeStore: "default",
    isSaving: false
  }
})
// assert storeEntries order
// call saveEditStore with valid/invalid data, assert emits
// call confirmDeleteStore, assert store removed from emits
```

---

### 7. EntryDetail (299 LOC)

**Purpose:** Display entry details — secret with show/hide, copy, metadata, action buttons.

**Non-trivial behaviors:**
- Secret visibility toggle (`isSecretVisible`)
- `copySecret()`: copies to clipboard via `clipboard.copy()`, shows toast with clear timer
- `copyValue()`: copies individual metadata values
- Skeleton loading: 500ms timer shown when `currentEntry` not yet matching `currentPath`
- Skeleton timer cleared on entry arrival or selection change
- `friendlyLabels` map: known keys get friendly names (username, URL, email, etc.)
- `getLabel()`: returns friendly label or raw key
- `metadataEntries` computed from entry
- Action buttons: edit, rename, duplicate, move, delete (delegated to sub-dialogs)
- Empty state with new/generate buttons

**What to test:**
- `toggleSecret`: flips `isSecretVisible`
- `copySecret`: calls `clipboard.copy` with entry secret, shows toast with `action.timerSeconds`
- `copyValue`: calls `clipboard.copy` with value
- Skeleton timer: `showSkeleton` stays false immediately, becomes true after 500ms if entry not loaded
- Skeleton timer: cleared when `currentEntry` arrives matching `currentPath`
- `getLabel`: "username" → "Username", "URL" → "Website", "unknown" → "unknown"
- `metadataEntries`: produces entries from entry.metadata object

**What NOT to test:**
- shadcn-vue Button wrappers
- Template rendering structure
- EntryForm internals (tested separately)

**Test pattern:**
```
mount(EntryDetail, {
  global: { plugins: [createPinia()] }
})
// mock clipboard store
// set treeStore.currentEntry, currentPath
// call copySecret, copyValue, assert clipboard.copy called with correct args
// test skeleton timer with fake timers
```

## Additional Recommendations

### Lightweight Test Candidates (beyond the 7)

These dialog components have non-trivial logic (validation, path manipulation, mode branching) that warrants lightweight pure-function-style tests:

| Component | LOC | What to test |
|---|---|---|
| `CreateFolderDialog` | 102 | `buildFullPath()` joining, `handleSubmit()` empty-name validation, store interaction |
| `RenameEntryDialog` | 135 | `currentName` / `parentDir` path parsing, `buildNewPath()`, `handleSubmit()` empty + same-name validation |
| `MoveOrDuplicateDialog` | 238 | `buildFullDestination()` path joining, mode-dependent computed labels, `createNewFolder()` validation + store call, `handleSubmit()` empty + same-path validation, `watch` initialization |

These can be tested with lighter patterns — either pure function extraction of the path utilities, or shallow mount + validate + mock store.

### Exempt Components (confirmed)

Components exempt per team consensus ("Dialog passthroughs and shadcn-vue wrappers"):

- **Pure dialog passthroughs:** `DeleteConfirmDialog`, `StoreDeleteDialog` — single action, no branching logic
- **Thin wrappers:** `EditEntryDialog`, `InsertDialog`, `PasswordGenerator`, `GenerateDialog` — trivial validation, form passthrough
- **Recursive display:** `DirectoryTree` — trivial expand/collapse, recursive template
- **Settings form tabs:** `ClipboardTab`, `ExtensionsTab`, `GenerationTab`, `InfoTab`, `PreferencesTab` — pure model bindings
- **Mode toggle:** `ModeToggle` — trivial dropdown
- **Readiness:** `ReadinessGate`, `BlockedScreen`, `IssueCard`, `LoadingScreen` — lifecycle tested at integration level, pure display
- **Pages:** `index.vue`, `settings.vue`, `test.vue` — integration-level orchestration
- **Icons:** All 5 icon files — pure SVG stubs

## Key Decisions Made

1. **7 core components warrant full Vue Test Utils mount tests** with mocked stores/services — EntryForm, Tree, AppSidebar, AddStoreWizard, GpgTab, StoresTab, EntryDetail
2. **3 additional dialog components warrant lightweight tests** (CreateFolderDialog, RenameEntryDialog, MoveOrDuplicateDialog) — pure function + shallow mount
3. **All other components are exempt** — confirmed shadcn-vue passthroughs, form-binding stubs, or integration-level orchestration
