# pass-gui Full Codebase Review — Final Report

Date: 2026-08-22 · Scope: `client/src` app code (~86 files) · Method: 10 parallel subagent batch reviews (vertical slices by domain), pilot-validated house-style brief. Raw per-batch reports: `batch-01.md` … `batch-10.md` in this directory.

Skipped as vendored/scaffold: `components/ui/**` (shadcn-vue), `components/icons/*`, generated `route-map.d.ts` (drift-checked only), tests/infra configs.

Verdict distribution: 24 Clean · 20 Minor issues · 12 Needs fixes · 0 data-loss-critical beyond those listed below.

---

## Critical bugs (fix first)

| # | File | Bug | Batch |
|---|------|-----|-------|
| C1 | `lib/shell.ts` | ~~Windows quoting doubles backslashes before normal chars and fails to double them before embedded quotes → argument boundaries break for any Windows path with backslashes.~~ ✅ Fixed (owner confirmed Windows is a supported target): reimplemented per MS CommandLineToArgvW rules — runs doubled only before quotes, embedded quotes escaped `\"`, trailing runs doubled. | 02 |
| C2 | `services/config.ts` | ~~`setValue`/`removeValue` mutate `_raw` but `save()` validates the stale `data` snapshot → written values bypass Zod validation; an invalid write (empty `active_store`, removed active store) bricks config loading on next startup.~~ ✅ Fixed: `save()` validates `_raw` (what stringify serializes) and evicts the poisoned cache entry on validation failure. | 06 |
| C3 | `pages/settings.vue` | ~~Failed `Config.load()` leaves `config` null yet renders tabs via `config!` → white-screen crash exactly when the config file is broken. Needs a `loadError` branch.~~ ✅ Fixed: extracted `loadConfig()`, added a persistent error branch with the message + Retry. | 09 |
| C4 | `pages/settings.vue` | ~~Multi-field tab saves fire unawaited concurrent read-modify-write cycles over the whole config file → last-writer-wins silently reverts sibling fields (Generation ×5, Clipboard ×2, GPG ×3) with false success toasts.~~ ✅ Fixed: `Config.setValues()` batch setter (one load→mutate→save cycle per section); one toast per save; `undefined` deletes optional keys (sidesteps open question #5). | 09 |
| C5 | `Tree.vue` + `AppSidebar.vue` | ~~Context-menu and Mod+V paste discard the `pasteEntry` Result (`void …`) → failed pastes are silent AND the buffer was already cleared pre-flight, so the user loses their cut/copy state.~~ ✅ Fixed: buffer cleared only on success (retryable), all three call sites notify via `useNotifyResult`. | 04 |
| C6 | `services/gpg.ts` | ~~`checkVersion()` returns stale singleton version data as a successful `Ok` when `gpg --version` output is unparseable (regex miss keeps previous/zeros version, still returns Ok).~~ ✅ Fixed in both `gpg.ts` and the identical twin in `pass.ts`: reset version + `Err` on unparseable output. | 07 |
| C7 | `services/filesystem.ts` | ~~`exists()` returns `Err` when the path simply doesn't exist — the one query where absence is an expected answer. Every caller conflates "absent" with "failed" (`pass.checkInitialized`, `Config.exists`).~~ ✅ Fixed: `NE_FS_NOPATHE` → `Ok(false)`, genuine stat failures stay `Err`; `Config.ensure` now fails closed on exists-errors instead of writing defaults over a possibly-real config. | 03 |

## Systemic patterns (flagged in ≥3 batches)

### S1 — Silent Err drops at the last hop
~~Results are produced correctly by services and stored canonically, then discarded by consumers: clipboard-clear consumers (B01), paste call sites (B04), `Watcher.watch` results in `config.load` and `AppSidebar` (B06/B04), `Fs.rmdir` rollback result (B08), `main.ts` init Results (B10), `use-generation-config` fallbacks (B05).~~ ✅ Fixed: clipboard-clear + paste sites in B01/C5; `Fs.rmdir` rollback, generation-config fallbacks, and `Pass.init` swallow now log via Logger. Not changed: `Watcher.watch` drops already log inside the service (double-handling adds nothing); `main.ts` init Results are known boot debt per owner (#6).
 **Fix-once direction:** lint rule or convention review for unhandled Results; route through `useNotifyResult`/`.match`/Logger.

### S2 — Dead code accumulation
~~`InsertDialog`, `EditEntryDialog` (B04), `GenerateDialog` (B05), `PreferencesTab` (B09)~~ ✅ deleted (428 lines). ~~dead `Scissors` import (B01)~~ ✅ removed from EntryDetail (Tree.vue's is used — reviewer false positive). Owner decision: keep the remaining unused utility symbols (`makeIgnoreFilter`, `validateBehavior`, `brand()`, `SYSTEM_PASS_PATHS`, unused types, per-section validators) — components only for this sweep.
**Fix-once direction:** delete all; git history preserves them.

### S3 — Treating any Err as "absent", then proceeding destructively
~~`pass.init` swallows check errors as `Ok(false)` (B02)~~ ✅ now logs the swallowed error (behavior unchanged — inert today, no consumer reads `isInitialized`); ~~`exists()` semantics (C7/B03); `Config.ensure()` treats an exists-*error* as missing and writes defaults over a possibly-real config (B06)~~ ✅ fixed via C7; ~~readiness swallows `hasEntries` errors → reports READY (B07)~~ ✅ new `STORE_SCAN_FAILED` blocking state + issue; ~~`Store.create/add` guard treats config-read errors as not-found → silent clobber path (B08)~~ ✅ existence probed via `Config.getValue` — config-read errors return `config-read-failed`, only confirmed-absent names proceed; ~~AddStoreWizard defaults failed store detection to *create* mode → risks `pass init` rewriting an existing `.gpg-id` (B08)~~ ✅ detection failure blocks advancing with an inline error (+ `console.warn` → Logger).
 **Fix-once direction:** fail closed at trust boundaries; distinguish not-found from failure everywhere an action follows the check.

### S4 — Duplicate parallel implementations
~~Two divergent pass-format parsers (`parse-pass-show.ts` vs `entry-content.ts`, disagreeing on comment stripping) (B02)~~ ✅ unified on PRESERVE (owner decision, open q8): `parse-pass-show` no longer strips inline comments from metadata values — entry content is user data and the edit round-trip must not drop it; `stripInlineComment` remains for `.gpg-id` parsing only (pass spec); ~~byte-identical `EntriesReadError`/`EntriesWriteError` classes (B02)~~ ✅ shared `EntriesOpError` base; ~~dead dialog twins of EntryForm (S2/B04)~~ ✅ deleted; ~~path-segment splitting re-implemented ×5 (B04)~~ ✅ `Path.baseName`/`Path.parentPath` in lib/path.ts, six sites deduped; OS-type vocabulary triplicated (B10) — **reviewer false positive**: no duplicated union exists, all sites compare against the canonical `Neu.OS`; path.ts reads `window.NL_OS` directly to avoid the lib→services import inversion. Skipped.
 **Fix-once direction:** one canonical parser + shared helpers.

### S5 — Manual `cause` fields shadow ES2022 `Error.cause`
~~Every per-op error class redeclares `public cause: Error | null` after passing it via `super(message, { cause })`: clipboard trio (B01), `PassExecError` (B02), `FsReadError`/`FsStatError` (B03), `GpgKeyListError` (B07), `CreateStoreError`/`AddStoreError` (B08).~~ ✅ Fixed: all 12 declarations dropped across 7 files; the standard `cause` set via `super(message, { cause })` remains (no consumer reads `.cause`, so the null→undefined shift is inert).
 **Fix-once direction:** drop the field declarations; rely on the standard property.

## Design issues worth escalating (one line each)

- ~~`stores/clipboard.ts` + `EntryDetail.vue`: failed clipboard clear resets UI state while the secret stays live in the OS clipboard — core safety path (B01).~~ ✅ Fixed: clear failure keeps countdown/"still copied" state alive (+ auto-clear retry), Clear buttons notify via `useNotifyResult`.
- ~~`DeleteConfirmDialog.vue`: native `AlertDialogAction` close fires before the awaited Result resolves → dialog closes even on failure (B01).~~ ✅ Fixed: swapped for a plain destructive `Button` — reka-ui's action closes via its own click handler, so `preventDefault` would NOT have worked; the handler now owns the open state.
- `stores/entry-tree.ts`: `moveEntry` selection rewrite uses naive substring replace (`"a"` matches inside `"a2"`) → corrupted selected paths; paste into own descendant unguarded (B03).
- `filesystem.ts`: `join`/`relativePath` return bare promises (can reject) violating the Result contract used everywhere else (B03).
- `entries.ts`: `generate()` accepts length/symbols options and never uses them; `-f` force-overwrites without consent while `insert` respects force; `copy()` round-trips plaintext through JS instead of `pass cp` (B02).
- `shell.ts`: `checkSneakyPath` fails open on normalization errors; lib→services import inversion (B02).
- `errors.ts`: `CommandFailedError` mangles stored args (phantom entries) and builds a malformed message (B02).
- `config.ts`: watcher-setup failure swallowed; `getValue` can return `Ok(undefined)` typed as required (B06).
- `readiness.ts`: keyring-listing failure misreported as ".gpg-id parse error"; `GPG_VERSION_TOO_OLD` issue exists but no check ever runs it (B07).
- `store.ts` recipes: partial-failure states (init succeeded, config write failed) leave initialized-but-unregistered stores — acceptable, document the ceiling (B08).
- `active-store.ts`: `switchStore` persists config before applying → broken name persisted if apply fails (B08).
- `AddStoreWizard.vue`: GPG-key step mandatory even when adding an existing store where the selection is discarded (B08).
- `main.ts` + `neutralino.ts`: `Neu.init()` throws (only non-Result service method) → unhandled top-level rejection path; app mounts before init completes (B10).
- `AppSidebar.vue`: filesystem-watcher/polling infra (setInterval + service imports) embedded in a component; sidebar never renders `treeStore.error` so failed loads look like an empty store (B04).
- `generate-password.ts`: modulo bias in `secureRandomInt` (negligible magnitude, wrong place to be approximate in a password manager) (B05).

## Minor issues (collapsed lists)

- **Stale/duplicated docs:** doc comments saying errors are "thrown" (filesystem), stale `EntryDetail.path` doc, misleading watcher comment in AppSidebar, JSDoc length bounds that nothing enforces.
- **Unvalidated numeric inputs:** Generation/Clipboard/Preferences tabs rely on `:min`/`:max` which don't clamp typed values (B09); three disagreeing password-length ceilings (64 slider / 128 docs / 128 schema) (B05).
- **Timer/ref hygiene:** uncleared `setTimeout`s on unmount (~~EntryDetail skeleton~~ ✅ cleaned up, InfoTab copied flags); ~~`timerId` in a ref needlessly reactive (clipboard store)~~ ✅ plain closure var; timer helpers unexported from the store.
- **Duplication nits:** copySecret/copyValue toast blocks ✅ deduped (copySecret delegates); memorable/symbols switch blocks; folder-picker button markup ×3; `SortMode` type duplicated; `Table` alias duplicated.
- **Dead flexibility:** dialog trigger branches never rendered (RenameEntryDialog, StoreDeleteDialog); seven unused per-section config validators; redundant `isFile` re-check in `parseGpgId`.
- **UX polish:** five success toasts per Save click; silent no-op on duplicate-path edit save (StoresTab); retry button dead when no store configured; password visible-by-default in create mode; misleading "No GPG keys found" copy on load failure.

## Open questions for owner

1. ~~Is Windows a supported target? Determines urgency of C1.~~ ✅ Answered: yes — C1 gets the full fix.
2. ~~Is the `[config-debug]` flattening-bug investigation still live?~~ ✅ Answered: dead — scaffolding removed in the C2 fix.
3. Are InsertDialog/EditEntryDialog/GenerateDialog/PreferencesTab retained for planned flows, or deletable?
4. ~~Should a failed clipboard clear keep the countdown UI alive ("still copied" state) or is best-effort clearing the accepted ceiling?~~ ✅ Answered: keep countdown alive — implemented in the B01 clipboard-clear fix.
5. Does j-toml `stringify` throw on undefined values (settings.vue passes `undefined` to "clear" keys)? Determines whether that path fails loudly or corrupts.
6. Is mounting before `Neutralino.init()` known-safe, or should boot order invert?
7. First-run semantics: does `DEFAULT_CONFIG.core.active_store` guarantee validity, and should `ensure()` fail closed on exists-errors?
8. ~~Inline comments in entry files: stripped (parse-pass-show) or preserved (entry-content) as canonical read behavior?~~ **Answered (owner): preserve.** Entry content is user data; inline comments are only stripped in `.gpg-id` parsing per pass spec.

## Coverage

Reviewed in full: 74 app files across 10 batches (see batch files for per-file verdicts). Not deep-reviewed: vendored `components/ui/**`, icons scaffold, integration tests (`tests/integration/*`), build configs.
