# Batch Review: 3 of 10
**Files:** services/filesystem.ts, lib/store-walker.ts, lib/tree-state.ts, lib/tree-index.ts, lib/path.ts, composables/use-tree-state.ts, stores/entry-tree.ts **Composition:** vertical slice family (filesystem + tree domain: service → tree libs → store) **Reviewer:** subagent-3

## House Style Reference
- Result<T,E> contract: all services/stores return Results, chained via .match()/.andThen()/.mapErr()/inspect; try/catch is banned everywhere except logger and watcher infra.
- Store purity: Pinia stores are setup functions with no toast/router/DOM imports; error state is canonically a `Ref<Error | null>` — don't flag that shape.
- Components consume errors via useNotifyResult(...) or `.match(...)` on Results; direct sonner imports are bugs except App.vue (global relay) and EntryDetail.vue (rich toast) — flag only a third.
- Layer boundary: all I/O lives in services/ (filesystem, pass, gpg, clipboard, config, store, entries); Neutralino.* calls from components or stores are design violations.

## Per-file reviews

### `client/src/services/filesystem.ts`
**Path:** client/src/services/filesystem.ts **Purpose:** NeutralinoJS filesystem wrapper returning Results, plus flat→tree conversion and gitignore filtering. **Verdict:** Needs fixes

#### Critical bugs
**`exists()` returns Err when the path simply doesn't exist**
- What happens: "Does this path exist?" is the one query where ENOENT is an *expected answer*, not a failure — yet it surfaces as `Err(FsStatError)`. Every caller must collapse error+false by hand, and real failures (permissions) are indistinguishable from absence.
- Where:
```ts
// filesystem.ts:278-287
static async exists(
  path: string
): Promise<Result<boolean, FsStatError | Error>> {
  const resolvedPath = await Filesystem.resolvePath(path);
  if (resolvedPath.isError()) return Err(resolvedPath.error);

  const res = await Filesystem.getStats(resolvedPath.ok);
  if (res.isOk()) return Ok(res.ok.isFile || res.ok.isDirectory);
  return Err(res.error);
}
```
- Why it's wrong: Downstream callers already paper over it (`readiness.ts:176` does `if (exists.isError() || !exists.ok)`, `pass.ts:82` returns it raw so `checkInitialized` errors on an uninitialized store instead of reporting `false`). `Config.exists()` (config.ts:58) reports a first-run missing config as an error Result. The function's name promises a boolean question; it delivers a stat operation.
- Fix:
```ts
static async exists(
  path: string
): Promise<Result<boolean, FsStatError | Error>> {
  const resolvedPath = await Filesystem.resolvePath(path);
  if (resolvedPath.isError()) return Err(resolvedPath.error);

  const res = await Filesystem.getStats(resolvedPath.ok);
  // ponytail: any stat failure means "not usable" — refine to code check if
  // distinguishing EACCES from ENOENT ever matters
  return Ok(res.isOk());
}
```

#### Design issues
1. **Dead code: `makeIgnoreFilter` is exported but never used anywhere in the codebase**, and its doc comment describes an IPC-per-entry design (`Filesystem.relativePath` call per uncached path) that `readDirectory` deliberately replaced with the inline fast path (filesystem.ts:469-482). Delete it — keeping both invites someone to use the slow IPC version.
2. **`Fs.join()` and `Fs.relativePath()` violate the Result contract**: they return bare promises over Neutralino IPC calls that can reject (`filesystem.getJoinedPath`, `getRelativePath`). Every other method wraps in `wrapAsync`. These are called from the store (`entry-tree.ts:192,230`) where a rejection would be an unhandled promise path outside the store's `error` ref.
```ts
// filesystem.ts:380-382, 401-406
static async join(...paths: string[]): Promise<string> {
  return await filesystem.getJoinedPath(...paths);
}
...
static async relativePath(
  absolutePath: string,
  base: string
): Promise<string> {
  return await filesystem.getRelativePath(absolutePath, base);
}
```
Fix: wrapAsync + Result like every sibling method (join becomes breaking for ~all callers, so batch it deliberately).

#### Minor / style
- `writeFile` hardcodes `"NE_FS_FILWRER"` (line 508) while `mkdir` uses `NEU_ERROR_CODES_MAP.DirectoryCreationFailed` — use the map constant for both.
- `FsReadError`/`FsStatError` are structurally identical duplicates; also they redeclare `public cause: Error | null` and then overwrite what `super(message, { cause })` already set with the same value — drop the field, ES2022 `Error.cause` covers it.
- Doc comments say errors are "thrown" (`FsMkdirError`, `FsWriteError`) — they're returned in `Err`; misleading wording.
- `mkdir` has a TOCTOU skip-if-exists race (isDirectory check then create); harmless in practice, but a createDirectory failure due to concurrent creation would surface as an error.
- `getStats` resolve-failure path (line 325) constructs `FsStatError(path, ...)` without attaching `resolvedPath.error` as cause and without logging, unlike every other error path.

#### Confirmed correct
- Inline ignore filter before tree building (lines 471-482): looks like duplicated logic vs `makeIgnoreFilter`, but the comment explicitly documents the fast-path rationale (no IPC) — correct approach, the dead helper is the thing to remove.
- `buildTree` prefix-stripping with `endsWith("/") ? : +"#/"` normalization: correct root-relative path derivation.
- Result-returning service methods, no try/catch, Logger for diagnostics: matches house brief exactly.
- `isFile` using `!isDirectory`: the NOTE comment acknowledges it deliberately (symlinks etc. count as files) — fine for this app's needs.

### `client/src/lib/store-walker.ts`
**Path:** client/src/lib/store-walker.ts **Purpose:** Walks the store directory into a filtered, extension-stripped EntryNode tree. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- `filterGpgNodes` keeps *every* empty directory at any depth (line 42-45), not just top-level newly-created ones as the doc implies — an empty junk folder three levels down will render. Documented intent ("Empty directories"), so noting only.
- `walkStore`'s example doc says `result.ok` items have `path` but the example output omits `path` on the directory node — cosmetic doc drift.

#### Confirmed correct
- Returning `Ok([])` when everything filters out (line 98): correct — empty tree is success, not error.
- Ignore of `.git`/`.gpg-id` delegated to `readDirectory` rather than re-filtered here, as the comment states — no double filtering.

### `client/src/lib/tree-state.ts`
**Path:** client/src/lib/tree-state.ts **Purpose:** Pure functions for visible-node computation, sorting, search projection, expand/collapse sets. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- `sortPaths` falls back to raw path string when node missing from index (lines 21-22) — silently tolerates stale paths; acceptable defensive default.
- `buildSearchResults` doesn't apply `sortMode` — search results follow tree insertion order regardless of sort preference. Probably fine; flag only if users notice.

#### Confirmed correct
- Ancestor-inclusion loop in `buildSearchResults` (lines 83-88) walks `parent` chain correctly and terminates at root (`parent` = null).
- Immutable Set copies in `expandSet`/`collapseSet` — correct Vue reactivity pattern for ref-held Sets.

### `client/src/lib/tree-index.ts`
**Path:** client/src/lib/tree-index.ts **Purpose:** Flattens an EntryTree into byPath/parent/children lookup maps. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- Magic sentinel `"__root__"` shares the same namespace as real node paths: a literal entry named `__root__` at the top level would have its `children` map entry overwritten by line 22-25 (root list set after... actually before walk, but walk then overwrites it with the node's own children). Use a Symbol-ish key or a separate field on TreeIndex. Probability ~0 for password stores, hence minor.
- Duplicate paths in the input tree silently alias in `byPath` — fine given upstream guarantees uniqueness.

#### Confirmed correct
- Recursion depth bounded by store depth; no cycles possible since tree is built from a flat FS listing.

### `client/src/lib/path.ts`
**Path:** client/src/lib/path.ts **Purpose:** Tilde expansion, home-dir caching, known-path and system-root resolution. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- Module-level `cachedHomeDir` is never invalidated — home dir doesn't change mid-session in practice; fine.
- Default-export object vs named exports elsewhere — consistent enough within lib/.

#### Confirmed correct
- `window.NL_OS` access here: reads a runtime global, but this is lib/ not a store — house purity rule doesn't apply.
- `expandTilde` lookahead regex `^~(?=[/\\]|$)` correctly avoids mangling `~foo` usernames-style inputs.

### `client/src/composables/use-tree-state.ts`
**Path:** client/src/composables/use-tree-state.ts **Purpose:** Composable wiring tree index + expansion/focus/keyboard state onto the entry-tree store. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- **Temporal-dead-zone-shaped ordering**: the watch callback (line 19) references `expandedDirs` declared at line 29. Safe today because watch callbacks flush asynchronously after setup completes, but it's one refactor away from a TDZ ReferenceError — move the `ref` declarations above the watch.
```ts
// use-tree-state.ts:12-29
watch(
  () => treeStore.tree,
  newTree => {
    ...
    for (const path of expandedDirs.value) {   // declared below
```
- **`arrowRight` descends in unsorted order**: uses `index.children.get(fp)[0]` (line 111-113), which is tree-construction order, not `treeStore.sortMode` order — focus lands on a different child than the visually-first one when reverse-sorted. Route through `sortPaths`.
- `focusPrev` with no prior focus wraps to the *last* node while `focusNext` starts at the *first* (lines 78 vs 92) — asymmetric, likely unintended.
- `focusNext`'s `Math.max(0, findIndex)` sends focus to node 0 when the focused node was filtered out of view; staying put or clamping to nearest would be kinder. Cosmetic.

#### Confirmed correct
- `shallowRef` + full replacement of `index` — correct way to avoid deep-reactivity overhead on Maps.
- Pruning stale `expandedDirs` against the new index inside the watch — prevents zombie expansion state after mutations.
- Fire-and-forget `treeStore.selectEntry(path)` (line 52): errors land in the store's canonical `error` ref per house style; composable needn't handle them.

### `client/src/stores/entry-tree.ts`
**Path:** client/src/stores/entry-tree.ts **Purpose:** Setup store owning the entry tree, selection, sort mode, copy/cut buffer, and CRUD orchestration. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
1. **`moveEntry` selection rewrite can corrupt paths via naive substring replace**: the guard checks the `${oldPath}/` prefix but the replacement replaces the *first occurrence anywhere* in the string.
```ts
// entry-tree.ts:144-148
} else if (selectedPath.value?.startsWith(`${oldPath}/`)) {
  selectedPath.value = selectedPath.value.replace(oldPath, newPath);
} else if (selectedPath.value === oldPath) {
```
Example: `oldPath = "a"`, `selectedPath = "x/a2/a"` → replace hits the `"a"` inside `"a2"`, producing `"x/newPath2/a"`. Fix: `selectedPath.value = newPath + selectedPath.value.slice(oldPath.length)`.
2. **No paste guards for degenerate moves**: pasting a cut folder into its own descendant, or into its current parent (no-op move), is passed straight to `Entries.move`. The pass CLI will error confusingly or worse for descendant moves. One guard in `pasteEntry` (compare source/dest prefixes) closes it.
3. **Buffer cleared before the paste operation** (entry-tree.ts:235): documented rationale (UI state during flight), but a failed paste loses the user's clipboard buffer entirely with no recovery — either clear on success, or restore on failure.

#### Minor / style
- `SortMode` type is duplicated verbatim in `lib/tree-state.ts:3` and here (line 11) — export one from a shared module.
- `pasteEntry` returning `undefined` for empty buffer breaks the Result contract shape; the doc comment justifies it and callers gate on buffer existence — acceptable, but `Result<MutationResult|undefined, ...>` would keep types uniform.
- Repeated `error.value = result.error; return result` block across six actions — a tiny `failWith(e)` helper would collapse it; not required.
- `insertEntry`/`editEntry` discard the awaited `selectEntry` result — errors still land in `error` ref, consistent with house style, fine.

#### Confirmed correct
- No toast/router/DOM imports; `Ref<Error | null>` for `error`; setup-store form — all match the house brief.
- `readonly(buffer)` exposure with mutation only through actions — correct encapsulation.
- Distinctly-named `CopyBuffer` vs system-clipboard store, with explanatory comment — intentional, not a naming bug.
- `createFolder` joining `Pass.storePath` + user `folderPath` and going through `Fs.mkdir` directly (bypassing pass CLI): the path-traversal concern is softened by `Pass.exec` validating arguments for pass-routed operations, but note `mkdir` itself performs no traversal validation — see Open Questions.

## Batch Summary
- Files reviewed: 7 / 7
- Critical bugs: filesystem.ts — `exists()` returns Err for nonexistent paths (the expected case), forcing every caller to conflate "absent" with "failed".
- Design issues worth escalating: filesystem.ts (`makeIgnoreFilter` dead code; `join`/`relativePath` break the Result contract), entry-tree.ts (naive substring replace in `moveEntry`; paste-into-descendant unguarded; buffer loss on failed paste).
- Cross-cutting patterns in THIS batch only: pure lib functions (tree-index, tree-state, store-walker) are consistently clean and well-documented — the defects cluster at the I/O boundary and in the store's orchestration glue; error classes in filesystem.ts drift between NeuError subclasses, plain Errors, and hardcoded codes.
- Open questions (needs owner decision, not a guess):
  - Should `createFolder` validate `folderPath` for traversal (`../`) before `Fs.mkdir`? Pass-routed writes get `validatePath`, but the mkdir path may not — owner should confirm whether that's covered elsewhere or accepted.
  - Is the always-keep-empty-directories rule in `store-walker.ts` meant to apply at all depths, or only root-level (as "newly created" suggests)?
  - `Fs.join()` signature change to Result affects many callers — approve as a dedicated follow-up?
