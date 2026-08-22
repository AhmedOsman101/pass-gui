# Batch Review: 4 of 10
**Files:** Tree.vue, DirectoryTree.vue, AppSidebar.vue, InsertDialog.vue, CreateFolderDialog.vue, RenameEntryDialog.vue, EditEntryDialog.vue, EntryForm.vue
**Composition:** consumer family (entry-tree UI consumers: tree views + CRUD dialogs + form)
**Reviewer:** subagent-4

## House Style Reference (restate in own words)
- Result<T,E> contract / try/catch: all service and store async ops return `Result`; components consume via `.match()` / `.andThen()` / `useNotifyResult`; try/catch is allowed only in logger and watcher infra — anywhere else is a finding.
- Store purity: Pinia setup stores never import toast, router, or DOM APIs; canonical store error state is `Ref<Error | null>`.
- Component error handling: components consume Results through `useNotifyResult(...)` or inline `.match(...)`; raw `sonner` imports in components are bugs except App.vue (global relay) and EntryDetail.vue (rich toast).
- Layer boundary: all I/O lives in services/ (fs, pass, gpg, clipboard, config, store, entries); direct `Neutralino.*` calls from components/stores are design violations.

## Per-file reviews

### `Tree.vue`
**Path:** client/src/components/Tree.vue
**Purpose:** Flattened sidebar tree renderer with context menus, keyboard nav, and CRUD dialog wiring.
**Verdict:** Needs fixes

#### Critical bugs
- **What happens:** Paste failures are completely silent, and a failed paste also destroys the clipboard buffer. Context-menu Paste fires the async store action and discards both promise and returned `Result`. `pasteEntry` clears `buffer` *before* the operation runs (entry-tree.ts), so on failure the entry drops out of cut/copy state and nothing moved — and this component never renders `treeStore.error`, so there's zero feedback.
**Where:**
```vue
<ContextMenuItem v-if="treeStore.buffer" @click="treeStore.pasteEntry(node.path)">
```
Tree.vue:185 and Tree.vue:214
**Why it's wrong:** Unhandled Err branch — violates "components consume errors via .match/useNotifyResult". Rename-target conflicts, fs errors, and duplicate-path failures are invisible to the user.
**Fix:**
```ts
async function onPaste(destDir: string): Promise<void> {
  const result = await treeStore.pasteEntry(destDir);
  result?.match({
    okFn: () => {},
    errFn: (e) => { /* surface e.message */ },
  });
}
```
```vue
<ContextMenuItem v-if="treeStore.buffer" @click="onPaste(node.path)">
```

#### Design issues
- **Global arrow/Enter/F2/Delete hotkeys with no input scoping.** Tree.vue:129–143 registers app-global handlers for ArrowUp/Down/Left/Right/Enter/F2/Delete. The sidebar search input lives in this view; unless @tanstack/vue-hotkeys ignores focused text inputs by default, arrow keys move tree focus instead of the caret while typing a search. See Open Questions.
- **F2 node-type lookup only searches visible nodes.**
```ts
const node = visibleNodes.value.find((n) => n.path === selectedPath.value);
openRename(selectedPath.value, node?.isDirectory ? "DIRECTORY" : "FILE");
```
Tree.vue:111–114 — if the selected node is hidden inside a collapsed directory, lookup misses and a directory silently renames as `"FILE"` type. Use the O(1) index (`buildIndex(...).byPath`) already in lib/tree-index instead.

#### Minor / style
- `nodeName()` splits paths per render per node; cosmetic.

#### Confirmed correct
- Copy/cut context items calling sync `copyEntry`/`cutEntry` without Result handling — those functions return `void` by design (buffer set, no I/O).
- Unscoped `<style>` block — TransitionGroup classes must be global to reach rendered children.

### `DirectoryTree.vue`
**Path:** client/src/components/DirectoryTree.vue
**Purpose:** Recursive directory-only picker tree (consumed by MoveOrDuplicateDialog for destination selection).
**Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- Files silently skipped (`v-if node.type === 'DIRECTORY'`). Correct for a destination picker, but a one-line "directories only by design" comment would prevent future confusion.

#### Confirmed correct
- Recursive self-reference without self-import — valid Vue SFC implicit self-reference, reinforced by `defineOptions({ name: "DirectoryTree" })`.
- Immutable Set copy in `toggle()` gives each recursion level independent expansion state — correct.

### `AppSidebar.vue`
**Path:** client/src/components/AppSidebar.vue
**Purpose:** Sidebar shell: sort dropdown, search box, tree host, copy/cut/paste hotkeys, store-watcher polling.
**Verdict:** Needs fixes

#### Critical bugs
- **What happens:** Mod+V paste drops the Result exactly like Tree.vue, plus the buffer is cleared pre-flight inside `pasteEntry`, so a failed paste silently loses the user's buffer with no feedback.
**Where:**
```ts
void treeStore.pasteEntry(destDir);
```
AppSidebar.vue:112 (also line 114)
**Why it's wrong:** Unhandled Err branch; violates the component-side Result-consumption rule.
**Fix:**
```ts
const result = await treeStore.pasteEntry(destDir);
result?.match({ okFn: () => {}, errFn: (e) => { /* surface e.message */ } });
```

#### Design issues
- **Watcher/polling infra embedded in a UI component.** `startStoreWatcher` owns a `setInterval` and imports `Pass` + `Watcher` services directly (AppSidebar.vue:133–152). This is infrastructure, not presentation: it belongs in a composable/store layer, otherwise two mounted instances double-poll and other views get no refreshes.
- **Dropped Result from `Watcher.watch`.**
```ts
await Watcher.watch("store", Pass.storePath, ".gpg-id");
```
AppSidebar.vue:137 — if arming fails, polling silently checks a watcher that never fired. Consume the error branch (watcher infra itself may try/catch internally, but the caller shouldn't discard its result).
- **No error rendering anywhere.** The `activeStore.hasStore` watch discards `loadTree()`'s Result (line 73) and the template has no branch for `treeStore.error` — a failed initial load shows the "No entries yet." empty state, indistinguishable from a genuinely empty store. Misleading and hides read errors.
- **Misleading comment:** "// Filesystem watcher: auto-refresh entry tree when active store changes" (line 132) — the code watches `Pass.storePath`, not the active store.
- **O(n) recursive `findNode` re-implements existing infrastructure.** A `TreeIndex.byPath` map already exists (lib/tree-index, used by use-tree-state); AppSidebar rebuilds linear searches in three hotkey handlers.

#### Minor / style
- `startStoreWatcher` (async) passed directly as a watch callback — a rejection becomes an unhandled rejection rather than surfacing anywhere.

#### Confirmed correct
- `void`-prefixed floating promises on paste (style aside) at least acknowledge async-ness; the real problem is the discarded Result, covered above.
- Consuming stores (`useEntryTreeStore`, `useEntryFormStore`, `useActiveStoreStore`) only through Pinia — no direct Neutralino.* calls here despite importing service singletons for paths.

### `InsertDialog.vue`
**Path:** client/src/components/InsertDialog.vue
**Purpose:** Modal dialog for creating a new entry (path + content).
**Verdict:** Needs fixes (dead code)

#### Critical bugs
None found.

#### Design issues
- **Dead component.** No file imports `InsertDialog` — creation flow goes through `formStore.openCreateForm()` → `EntryForm.vue`. It duplicates EntryForm's insert path with weaker validation (no duplicate-key check, no raw/form modes) and will drift. Delete it or wire it in; keeping both is two sources of truth for "create an entry".

#### Minor / style
- Manual two-way `open` plumbing (`isOpen = ref(props.open)` + two watchers, lines 31–42) — works, but `defineModel()` does this in one line.
- On success it clears `path`/`content` but not `formError`; next open shows stale success-era state if the previous submit failed after... actually inverse: a failed submit leaves `formError` set, and reopening shows the old error until next submit. Reset on open like CreateFolderDialog does.

#### Confirmed correct
- `result.match({ okFn, errFn })` consumption of `insertEntry` — exactly the house pattern.
- Preset-password watcher skipping `undefined` but applying `""` — intentional distinction between "no preset" and "clear preset".

### `CreateFolderDialog.vue`
**Path:** client/src/components/CreateFolderDialog.vue
**Purpose:** Controlled modal for creating a folder, optionally under a parent path.
**Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- Native `autofocus` attribute on the input (line 88) is unreliable inside teleported/dialog-rendered DOM; radix-vue DialogContent usually provides focus trapping/initial focus. Cosmetic.
- Field-reset watch (lines 30–38) is redundant in the AppSidebar usage since the parent `v-if` remounts the component fresh each open — harmless, and needed if ever mounted persistently.

#### Confirmed correct
- `result.match({ okFn, errFn })` on `createFolder` — house pattern.
- `buildFullPath()` joining parent + trimmed name — matches how `pasteEntry` builds destinations.

### `RenameEntryDialog.vue`
**Path:** client/src/components/RenameEntryDialog.vue
**Purpose:** Controlled modal renaming a file/directory via `moveEntry`.
**Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- `<DialogTrigger v-if="!open" as-child>` (line 102) is an odd dual-mode construct (works standalone via slot trigger, controlled when `open` passed). Both current call sites always pass `v-model:open` inside a `v-if`, so the trigger branch never renders — dead flexibility; simplify to the pure-controlled form.
- Same-name guard compares against `currentName` (last segment); renaming to a name differing only in surrounding whitespace is blocked by trim — fine.

#### Confirmed correct
- Pre-submit validation (empty name, unchanged name) before hitting the store; `moveEntry` Result consumed via `.match` — house pattern.
- `nodeType` passthrough to `moveEntry` — matches store signature.

### `EditEntryDialog.vue`
**Path:** client/src/components/EditEntryDialog.vue
**Purpose:** Modal editing full raw content of an entry via `editEntry`.
**Verdict:** Needs fixes (dead code)

#### Critical bugs
None found.

#### Design issues
- **Dead component.** Nothing imports `EditEntryDialog` — editing goes through `EntryForm.vue` (form/raw modes). Same drift risk as InsertDialog: it enforces "content cannot be empty", which EntryForm also enforces, but the two validators can diverge. Delete or wire in.

#### Minor / style
- `content` initialized from `props.currentContent` at setup *and* refreshed on open (lines 23–32) — the setup initialization is redundant given the open-watch; harmless because the dialog starts closed.

#### Confirmed correct
- `editEntry` Result consumed via `.match`; open-watch re-syncs from props so stale content from a previous session isn't saved — correct pattern.

### `EntryForm.vue`
**Path:** client/src/components/EntryForm.vue
**Purpose:** Full-page create/edit form with form-mode (secret/OTP/metadata/notes) ↔ raw-mode round-tripping, generator integration, and validation.
**Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **Reset watcher keys on `treeStore.currentEntry` identity.** The array getter `[formStore.formMode, formStore.formPresetPassword, treeStore.currentEntry]` (lines 63–84) wipes all form fields whenever `currentEntry` is replaced while in edit mode. Currently safe (currentEntry only changes via `selectEntry`, unreachable while the form is open, and post-save `refresh()` only reloads `tree`), but any future change that refreshes `currentEntry` mid-edit silently destroys unsaved work. Watching only `[formMode, formPresetPassword]` and reading `currentEntry` inside would be more honest about intent.

#### Minor / style
- Password starts **visible** in create mode (`isSecretVisible = ref(true)`, line 49). Deliberate-looking (generator flows want visibility) but worth an explicit decision for hand-typed secrets.
- Duplicate-key highlight marks *all* occurrences including the first (line 330); the inline hint "last value wins on save" partially justifies it, but flagging only repeats would be clearer.
- Raw→form round-trip (`toRawMode` then `toFormMode`) normalizes/reorders content through parse+serialize even with no edits — acceptable since submit serializes canonically anyway, but users may notice reformatting.
- Metadata rows keyed by `index` (line 322) — splice removal shifts keys; Vue handles it, but value-focus can jump rows on delete. Cosmetic.

#### Confirmed correct
- `let result: Result<MutationResult, EntriesReadError | EntriesWriteError>` + `.match` consumption (lines 195–212) — textbook house pattern.
- Raw-mode sync-before-validate in `handleSubmit` (lines 173–179) correctly orders parse ahead of secret/duplicate-key checks.
- `parseEntryContent`/`serializeEntryContent` from lib/ — no I/O, no layer violation; all writes go through `treeStore`.

## Batch Summary
- Files reviewed: 8 / 8
- Critical bugs:
  - Tree.vue — context-menu Paste discards the `pasteEntry` Result; failed pastes are silent and lose the buffer.
  - AppSidebar.vue — Mod+V paste handler same dropped-Result bug (`void treeStore.pasteEntry(...)`).
- Design issues worth escalating:
  - InsertDialog.vue and EditEntryDialog.vue are dead code duplicating EntryForm's responsibilities — delete or consolidate.
  - AppSidebar embeds filesystem-watcher/polling infrastructure (setInterval + Watcher/Pass services) in a component; should live in a composable/store.
  - Sidebar has no rendering of `treeStore.error`; failed loads masquerade as "No entries yet."
- Cross-cutting patterns in THIS batch only:
  - Dialog CRUD components are consistently well-behaved (controlled `open`, pre-validation, `.match` consumption) — CreateFolder/Rename are the model for the batch.
  - Two parallel "create entry" and "edit entry" UIs exist (dialog versions dead, form versions live) — the drift already visible (validators differ).
  - Path-segment splitting (`split("/").pop()`) re-implemented in five places across the batch (nodeName, dirPath, parentDir, currentName, pasteEntry) — a tiny shared helper would collapse them.
- Open questions (needs owner decision, not a guess):
  - Does `@tanstack/vue-hotkeys` ignore events originating in text inputs by default? Determines whether Tree.vue's global Arrow/Enter/F2/Delete bindings break search-input keyboard use or are merely aggressive.
  - Are InsertDialog/EditEntryDialog intentionally retained (e.g., planned mobile/compact layout) or safe to delete?
  - Is the store-level `error` ref surfaced anywhere globally (e.g., App.vue relay)? If yes, the "silent paste" severity drops one notch; nothing in this batch suggests it is.
