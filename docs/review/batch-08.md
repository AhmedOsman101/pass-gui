# Batch Review: 8 of 10
**Files:** client/src/services/store.ts, client/src/services/store-validation.ts, client/src/stores/active-store.ts, client/src/components/settings/AddStoreWizard.vue, client/src/components/settings/StoresTab.vue, client/src/components/StoreDeleteDialog.vue
**Composition:** slice (vertical family: store recipes service → validation → Pinia store → wizard/settings UI)
**Reviewer:** subagent-8

## House Style Reference (restate in your own words, one line each)
- Result<T,E> contract and where try/catch is allowed: every service/store method returns `Result` from lib-result and composes via `.match()/.andThen()/.mapErr()`; try/catch exists only in logger/watcher infra.
- Store purity rules: Pinia stores are setup stores that never import toast, router, or DOM APIs; their canonical error state is `Ref<Error | null>`.
- Component error handling: components surface Results via `useNotifyResult(...)` / `.match(...)`; direct sonner imports are bugs except App.vue and EntryDetail.vue.
- Layer boundary rule: all I/O (filesystem, pass, gpg, clipboard, config, Neutralino dialogs) lives in services/; components and stores must not touch Neutralino directly.

## Per-file reviews

### `store-validation.ts`
**Path:** client/src/services/store-validation.ts **Purpose (one line):** Static service validating pass-store paths: `.gpg-id` parsing, GPG recipient verification, behavioral `pass ls` check, entry scanning.
**Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **Dead code: `validateBehavior` has zero callers in the codebase.**
  ```ts
  static async validateBehavior(
    storePath: string,
    gnupgHome?: string
  ): Promise<Result<undefined>> {
  ```
  Where: store-validation.ts:179-189. Grep across client/src finds only its definition. Speculative need = skip it. **Fix:** delete until something needs it (YAGNI).

#### Minor / style
- `parseGpgId` re-checks `Fs.isFile(path)` then immediately calls `Fs.readFile(path)` which surfaces the same failure anyway — the existence check result (`ok === false`) isn't even acted on, so the check is pure redundancy (store-validation.ts:107-111).
- `verifyRecipients` matches against **secret** keys only. For "add existing store" this means recipients you can't decrypt for get flagged as `missingKeys` — arguably intentional (this GUI can't read those entries), but the docstring says "keyring" while the code checks secret keys only. Worth a docstring correction at minimum.

#### Confirmed correct (potential false positives)
- Returning structured data (`exists/initialized/missingKeys`) as `Ok` payload instead of `Err` for "not a store" states — correct: these are findings, not failures; `Err` is reserved for I/O errors.
- `ErrFromText("No valid key IDs found")` on empty `.gpg-id` — correct: pass itself rejects empty `.gpg-id`.

### `store.ts`
**Path:** client/src/services/store.ts **Purpose (one line):** Recipe service for store lifecycle: get/create/add/set/delete against config, with rollback on failed creation.
**Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **"Already exists" guard conflates all errors with "doesn't exist", allowing silent config overwrite.**
  ```ts
  const existingResult = await Store.get(name);
  if (existingResult.isOk()) {
    return Err(new CreateStoreError("already-exists", ...));
  }
  ```
  Where: store.ts:82-91 (same pattern in `add`, store.ts:153-162). `Store.get` returns Err for *three* distinct cases: config read failure, store-not-found, and "path is missing but gnupg_home set". Only the middle should mean "safe to create". A transient config read failure — or an existing entry with a blanked path — lets `create`/`add` proceed straight into `Config.setValue("stores", name, { path })`, silently clobbering the prior entry (including its `gnupg_home`). **Fix:** distinguish not-found from real failure, e.g. have `Config.getValue`'s not-found case observable (or check `stores` section explicitly) and treat genuine read errors as `"validation-failed"`/abort rather than falling through.
- **Rollback `Fs.rmdir` Result dropped silently.**
  ```ts
  if (!existedBefore) {
    await Fs.rmdir(data.path);
  }
  ```
  Where: store.ts:115-117. Best-effort rollback is reasonable, but the Err branch is discarded entirely — a failed cleanup leaves a stray directory with no trace. **Fix:** capture and append to the error message (or log via logger), e.g. include cleanup failure in the `CreateStoreError` cause chain.
- **Partial-failure state after `config-write-failed`:** if config write fails after `pass init` succeeded, the store is initialized on disk but unregistered, and there's no rollback of `.gpg-id`. Defensible (user can re-add via add-flow), but worth a `ponytail:`-style comment naming the ceiling.

#### Minor / style
- `CreateStoreError.cause: Error | null` shadows the ES2022 `Error.cause` field with a narrower type — works, but renaming to `innerError` avoids confusion with the standard property set by `super(..., { cause })`.
- `create` hardcodes `{ path: data.path }` into config; fine today since the wizard never supplies `gnupg_home` for new stores, but `set` is the only place that field gets written.

#### Confirmed correct (potential false positives)
- `(await Fs.isDirectory(data.path)).unwrapOr(false)` for `existedBefore` — correct: pre-check failure safely defaults to "don't delete", which is the conservative direction for a destructive rollback.
- Scoped `Pass.exec(args, { cwd, envs })` instead of mutating `Pass.storePath` — correct per the documented scoped-call pattern.

### `active-store.ts`
**Path:** client/src/stores/active-store.ts **Purpose (one line):** Setup Pinia store holding the active store name/path/config and delegating create/add recipes to `Store`.
**Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
- **`switchStore` persists before applying.**
  ```ts
  const setResult = await Config.setValue("core", "active_store", newStoreName);
  ...
  result = await applyStore(newStoreName);
  ```
  Where: active-store.ts:88-99. If `applyStore` fails (store vanished from config, path unresolvable), config now points at a broken store while local state still reflects the old one; the next app start will try to apply the broken name. Apply-first, persist-on-success is the same line count and removes the inconsistency window.

#### Minor / style
- `applyStore` flattens upstream errors into fresh `Error`s by interpolating `.message` only — original error object/kind lost (active-store.ts:39-41, 51-55). Wrapping the original as `cause` preserves debuggability.
- `createStore`/`addStore` don't reset `error.value` like `load`/`switchStore` do — inconsistent, though harmless since they communicate purely via returned Results.
- `load()` treats a failed `getValue("core","active_store")` as an error even on first run (no active store yet) — depends on `DEFAULT_CONFIG` providing a valid default; see Open Questions.

#### Confirmed correct (potential false positives)
- `error = ref<Error | null>(null)` plus no toast/router/DOM imports — exactly the canonical setup-store shape.
- `Pass.setStorePath(resolved.ok)` inside the store — documented legitimate caller ("one of the two legitimate callers"), and Pass import is a service import, not direct Neutralino.

### `AddStoreWizard.vue`
**Path:** client/src/components/settings/AddStoreWizard.vue **Purpose (one line):** Three-step dialog (name → path → GPG key) that creates or adds a store via `activeStoreStore.createStore/addStore`.
**Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **GPG-key step is mandatory even when adding an existing store, where the selection is silently discarded.**
  ```ts
  : activeStoreStore.addStore(input.name, { path: input.path })
  ```
  Where: AddStoreWizard.vue:103-105 vs. the gate `canCreate = selectedKeyId !== "" && !isCreating` (line 86-88) and the always-shown "3. GPG Key" badge (lines 234-239). When `isExistingStore` is true, `selectedKeyId` is never used — the user is forced to pick a key that does nothing, and the step label lies about what will happen. **Fix:** skip/replace the gpg step (e.g. a confirmation step) when `isExistingStore` is true, or auto-bypass the `canCreate` gate for that branch.
- **Failed validation during detection silently flips the wizard to "create" mode.**
  ```ts
  } else {
    console.warn("Store validation failed:", result.error.message);
    // Default to not existing — treat as new store
    isExistingStore.value = false;
  }
  ```
  Where: AddStoreWizard.vue:146-150. If the target directory *is* an initialized store but validation errored (I/O hiccup, permission issue), the wizard proceeds down the create path whose `pass init` would rewrite that store's `.gpg-id`. An error toast (`useNotifyResult`) instead of `console.warn` would match house style and stop the destructive path. Also note the double-detection: `pickFolder` runs `detectExistingStore` then `advanceStep` runs it again (lines 138, 160) — redundant but harmless.

#### Minor / style
- On `loadKeys` failure, `secretKeys` stays `[]` so the UI shows "No GPG secret keys found. Create one with gpg --gen-key" while a separate toast reports the actual error — misleading copy; consider distinguishing "load failed" from "none found".
- `resetWizard` doesn't clear `secretKeys`; keys are reloaded each open anyway, so cosmetic only.
- `CreateStoreError.kind` is available but `creationError?.message` is rendered raw — fine, kinds would just enable nicer per-step messaging later.

#### Confirmed correct (potential false positives)
- `useNotifyResult(result, { ok: false })` and `useNotifyResult(result, { ok: () => ... })` usage — correct pattern; no direct sonner import in this component.
- `NeuDialog.showFolderDialog` / `Gpg.listSecretKeys` / `StoreValidation.validate` — all I/O routed through services, no direct `Neutralino.*`.
- `canCreate` referencing `isCreating` declared below it (computed getter evaluated lazily post-setup) — no TDZ hazard.

### `StoresTab.vue`
**Path:** client/src/components/settings/StoresTab.vue **Purpose (one line):** Settings tab listing configured stores with inline edit, delete prompt, active-store select, and Add Store wizard mount.
**Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **Silent no-op on duplicate-path edit save.**
  ```ts
  if (!isPathUnique(path, editingStore.value)) {
    return;
  }
  ```
  Where: StoresTab.vue:89-91. The user clicks Save, nothing happens, no message, dialog stays open with no indication why. Every other rejection in this family surfaces via toast or inline text. **Fix:** show an inline error (mirroring `AddStoreWizard`'s computed `pathError` approach) instead of returning silently.

#### Minor / style
- `saveEditStore` emits both `updateStores` (local optimistic patch) and `saveStore` (persistence) — consistent with `confirmDeleteStore`/`handleStoreCreated`, so presumably the parent contract; flagging only because two parallel mutation channels per action is easy to desynchronize.
- Deleting/editing the active store's path updates config/local list but not `activeStoreStore`'s resolved `storePath` until reload — outside this batch's parent, but worth verifying the parent handles it.
- Duplicated folder-picker button markup three times — trivial, ignore unless touching anyway.

#### Confirmed correct (potential false positives)
- `Dialog.showFolderDialog` via services/dialog — correct layer boundary, not a direct Neutralino call despite the alias name.
- Trash button hidden for active store (`v-if="store.name !== activeStore"`, line 216) — correctly prevents deleting the store currently in use.
- `handleStoreCreated` writing `{ path: store.path }` without `gnupg_home` — fine: `StoreConfig.gnupg_home` is optional and `Store.create` never writes it.

### `StoreDeleteDialog.vue`
**Path:** client/src/components/StoreDeleteDialog.vue **Purpose (one line):** Confirmation alert dialog stating deletion removes config registration only, not disk contents.
**Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- `<AlertDialogTrigger v-if="!open" as-child><slot /></AlertDialogTrigger>` supports uncontrolled use, but the only consumer (StoresTab) always passes `v-model:open` and no slot — the trigger branch is currently dead flexibility. Harmless; keep if other consumers exist elsewhere.

#### Confirmed correct (potential false positives)
- Copy accurately describes behavior: "will NOT delete the directory on disk" matches `Store.delete` → `Config.removeValue` only. Honest security-relevant UX.
- Pure presentational component emitting events upward — no store/service/toast coupling; deletion logic correctly lives in the parent.

## Batch Summary
- Files reviewed: 6 / 6
- Critical bugs: None found.
- Design issues worth escalating:
  - `store.ts` already-exists guard conflates config-read errors with not-found → possible silent config overwrite (both `create` and `add`).
  - `AddStoreWizard.vue` failed validation detection defaults to create-mode, risking `pass init` overwriting an existing store's `.gpg-id`.
  - `AddStoreWizard.vue` forces meaningless GPG key selection when adding an existing store.
  - `active-store.ts` `switchStore` persists config before applying.
- Cross-cutting patterns in THIS batch only: clean layering throughout (all I/O via services, no sonner imports, no try/catch); recurring theme is *silent* fallbacks — dropped rollback Results, console.warn instead of notify, silent save no-op — where every sibling in the same file uses visible feedback.
- Open questions (needs owner decision, not a guess):
  - Is `verifyRecipients` checking secret-only keys intentional policy ("you can't decrypt what you lack"), or should public keys count as valid recipients?
  - Does `DEFAULT_CONFIG.core.active_store` guarantee a valid store on first run? If not, `active-store.load()` sets a startup error for every fresh install.
