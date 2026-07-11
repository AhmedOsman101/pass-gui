# 03: Define component test scope and patterns

Type: grilling
Status: resolved

## Question

Which Vue components warrant tests, and what should those tests validate?

## Resolution

### Components to test (7 core + 3 lightweight)

#### 7 Core Components — Vue Test Utils mount + mocked stores/services

| # | Component | LOC | Behaviors to test | Test pattern |
|---|---|---|---|---|
| 1 | **EntryForm** | 330 | Form validation (path/secret required, duplicate metadata keys), `buildContent()` format, create vs edit dispatch (`treeStore.insertEntry` vs `editEntry`), error display from store, password auto-gen on create, secret visibility toggle | `mount(EntryForm)` with mocked entryTreeStore + entryFormStore. Set formMode, call submit, assert validation errors or store calls. |
| 2 | **Tree** | 271 | Hotkey F2/Delete open dialogs, arrow keys trigger `focusNext`/`focusPrev`, `isCutDimmed`/`hasCopyBuffer`/`isSearchMatch` computed logic, `nodeName`/`dirPath` path parsing, context menu dialog state management | `mount(Tree)` with mocked entryTreeStore + useTreeState. Trigger hotkeys, assert dialog refs; pass searchQuery, assert computed helpers. |
| 3 | **AppSidebar** | 247 | Search debounce, store watcher start/stop lifecycle, hotkeys Mod+C/X/V with `findNode` traversal, sort mode dispatch, `activeStore.hasStore` → `treeStore.loadTree()` watch | `mount(AppSidebar)` with mocked stores + Watcher/Pass services. Simulate hotkeys, assert clipboard dispatches; mount/unmount test watcher lifecycle. |
| 4 | **AddStoreWizard** | 370 | Multi-step navigation (name→path→gpg→creating), name validation (empty/duplicate/invalid chars), path validation (empty/duplicate), `createStore()` orchestration (mkdir → pass init → config save), GPG key loading, existing store detection, wizard reset | `mount(AddStoreWizard)` with mocked Gpg/Pass/Config/Fs. Set step, advance, call createStore, assert service call sequence and emits. |
| 5 | **GpgTab** | 270 | Tag add/remove/edit with keyboard handling (Enter/comma/Backspace/Escape/blur), comma-separated paste, signing key mode switching (select/custom/none), recipient key mode, `keyLabel()` formatting | `mount(GpgTab)` with mocked Gpg service. Simulate tag input events, assert opts model changes; simulate select change, assert signingKey/recipientKey model updates. |
| 6 | **StoresTab** | 308 | `storeEntries` sorting (active first, alpha remainder), `isPathUnique` detection, `saveEditStore` validation + emit, `confirmDeleteStore` updates, `startEditStore` form init | `mount(StoresTab)` with mocked stores prop. Assert storeEntries order, call saveEditStore/confirmDeleteStore, assert emits. |
| 7 | **EntryDetail** | 299 | `toggleSecret`, `copySecret`/`copyValue` clipboard interaction with toast, skeleton timer (500ms delay + clear on entry arrival), `getLabel` friendly names mapping | `mount(EntryDetail)` with mocked clipboard store. Set entry data, call copy methods, assert clipboard calls; use fake timers for skeleton. |

#### 3 Lightweight Components — Pure function extraction + shallow mount

| Component | LOC | Behaviors to test |
|---|---|---|
| **CreateFolderDialog** | 102 | `buildFullPath()` path joining, `handleSubmit()` empty-name validation, `treeStore.createFolder` call |
| **RenameEntryDialog** | 135 | `currentName`/`parentDir` path parsing, `buildNewPath()`, `handleSubmit()` empty + same-name validation |
| **MoveOrDuplicateDialog** | 238 | `buildFullDestination()` path joining, mode-dependent labels (move vs duplicate), `createNewFolder()` validation + store call, `handleSubmit()` empty + same-path validation, form initialization watch |

### Exempt (no tests)

**Dialog passthroughs:** `DeleteConfirmDialog` (61L), `StoreDeleteDialog` (56L) — single-action AlertDialog passthroughs
**Thin wrappers:** `EditEntryDialog` (105L), `InsertDialog` (148L), `PasswordGenerator` (76L), `GenerateDialog` (128L) — trivial validation, form passthrough
**Recursive display:** `DirectoryTree` (63L) — trivial expand/collapse state
**Settings form tabs:** `ClipboardTab` (92L), `ExtensionsTab` (37L), `GenerationTab` (139L), `InfoTab` (201L), `PreferencesTab` (41L) — pure model bindings
**Mode toggle:** `ModeToggle` (36L) — trivial dropdown
**Readiness:** `ReadinessGate` (44L), `BlockedScreen` (51L), `IssueCard` (126L), `LoadingScreen` (13L) — lifecycle orchestration tested at integration level, pure display
**Pages:** `index.vue` (28L), `settings.vue` (285L), `test.vue` (30L) — integration-level orchestration
**Icons:** 5 files (~12L each) — pure SVG stubs

### Test patterns summary

- **Core components:** `mount()` from Vue Test Utils + `vi.mock("@neutralinojs/lib")` at module level + mocked Pinia stores via `@pinia/testing`
- **Lightweight dialogs:** Extract validation/path helpers as pure functions + shallow mount store interaction
- **All behavior tests** focus on: input validation, state transitions, callback propagation, error display
- **Explicitly NOT tested:** shadcn-vue wrapper components, template rendering structure, CSS/animations, trivial passthroughs

## Deliverables

Replaced by this resolved issue:
- Full inventory in `.scratch/test-strategy/reports/task-1-report.md`
- Map updated in `.scratch/test-strategy/map.md`
