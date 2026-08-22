# Batch Review: 6 of 10
**Files:** client/src/services/config.ts, client/src/services/config-validation.ts, client/src/lib/toml.ts, client/src/types/toml.ts, client/src/types/config.ts **Composition:** domain family (config persistence slice) **Reviewer:** subagent-6

## House Style Reference (restate in your own words, one line each)
- Result<T,E> contract and where try/catch is allowed: every services/stores function returns Result and chains via .match()/.andThen()/.mapErr(); try/catch is banned everywhere except logger/watcher infra (this codebase wraps throwers with lib-result's `wrapThrowable`/`wrapAsync` instead).
- Store purity rules (no toast/router/DOM; Ref<Error|null>): Pinia setup stores must stay side-effect free — no toast, router, or DOM imports; errors surface as `Ref<Error | null>` state.
- Component error handling via useNotifyResult/.match + the two exceptions: components consume Results through useNotifyResult(...) or .match(...); raw sonner imports are bugs except App.vue and EntryDetail.vue.
- Layer boundary rule (services own I/O): all Neutralino/filesystem/exec I/O lives in services/*; components and stores call services, never Neutralino directly.

## Per-file reviews

### `client/src/services/config.ts`
**Path:** client/src/services/config.ts **Purpose (one line):** Config service — load/save/validate the TOML config with mtime-watcher caching plus typed get/set/remove accessors. **Verdict:** Needs fixes

#### Critical bugs
**What happens:** `setValue`/`removeValue` mutate `_raw` but then `save()` validates `content.data`, which is the snapshot extracted at parse time and never updated. The newly written value therefore bypasses Zod validation entirely, while the validator green-lights stale pre-mutation data. Concretely: `setValue("core", "active_store", "")` or removing the currently-active store passes validation, gets written to disk, and the next `load()` fails `superRefine` (`active_store` not in stores / empty) — the app is then permanently unable to load its own config until the user hand-edits the file. The same staleness means a failed write leaves the cached `_raw` mutated but `data` stale (inconsistent cache).

**Where** (```ts
// config.ts:341-345
    // Modify _raw directly via cast - preserves comments when saved
    const raw = parsed._raw as AppConfig;
    (raw[section] as Record<string, unknown>)[key as string] = value;

    return await Config.save(parsed);
```, file:line — also config.ts:366-369, and the validating side config.ts:177)

**Why it's wrong:** The doc contract at config.ts:150-153 tells callers to mutate `_raw` "then pass the full parsed object to save()", but `save()` validates `data`, which no longer reflects `_raw`. Validation of the wrong object = the gate doesn't guard what's written.

**Fix** (```ts
static async save(content: ParsedToml<AppConfig>): Promise<Result<void>> {
  ...
  // Validate what will actually be written (_raw), not the stale data snapshot
  const validationResult = validateAppConfig(
    toml.extractCleanData<AppConfig>(content._raw)
  );
  ...
}
```)
(or re-extract inside `toml.stringify`'s sibling: expose an `extractData(table)` helper from lib/toml and validate that. Alternatively have setValue/removeValue mutate and re-derive `parsed.data` before saving — one shared fix in `save()`, since it routes all writers.)

#### Design issues
- **Unknown existence treated as absent → potential clobber of a real config.** In `ensure()`: (config.ts:238)
  ```ts
  if (existsResult.isError() || !existsResult.ok) {
  ```
  An FS error from `Fs.exists` (transient Neutralino failure) is conflated with "no config", and the recovery path *writes* the default config over whatever may be there. Error ≠ missing; writing on the error arm risks destroying user data. Fix: return `Err(existsResult.error)` when `isError()`, create defaults only on a confirmed `false`.
- **Watcher setup failure silently swallowed.** config.ts:85-88:
  ```ts
  const dirResult = await Fs.getPathParts(configPath.ok);
  if (dirResult.isOk()) {
    await Watcher.watch("config", dirResult.ok.parentPath, "config.toml");
  }
  ```
  The `Result` from `Watcher.watch` is discarded — no `.match`, no log. If watching fails, caching silently degrades (stale-cache logic then never triggers re-reads correctly since `hasChanged` returns false with no entry). At minimum `Logger.error` on the Err branch.
- **`getValue` silently falls back to defaults and can return `undefined` cast to a non-optional type.** config.ts:315-318: `value ?? defaultValue` — for optional keys this is intended, but for the `stores` section any unknown key yields `undefined as ConfigValue<S, K>` with `Ok` wrapping. A `Result` that carries an undefined payload typed as required is a contract smell; consider `ErrFromText` when both are undefined.

#### Minor / style
- config.ts:199-207: self-declared temporary debug scaffolding — two `console.debug` calls with `new Error().stack` capture and `eslint-disable`. The comment says "Remove once the flattening bug is root-caused." Flagging so it doesn't outlive the investigation; also note `Config.save()` is the *only* place left where the flattening symptom can be observed, so if the bug persists this is the instrument — coordinate before deleting.
- config.ts:248: `if (!dirExists.ok || dirExists.isError())` — property access before the error check; works (error implies `ok` falsy → mkdir attempted and its real error surfaces), but reversed vs. the file's own convention everywhere else (`isError()` first).
- config.ts:339 and 364: `if (!parsed)` is dead — `configResult.ok` on an Ok Result of `ParsedToml` is always a truthy object.
- Static mutable `_cachedResult` plus watcher flag is a small hidden-state machine; fine for now, but concurrent `load()` calls can double-read. Not worth fixing unless it bites.

#### Confirmed correct
- Result-returning service methods with explicit early `Err` returns throughout — matches house brief, not flaggable.
- No try/catch in this file; throwers are handled upstream (lib/toml wraps with `wrapThrowable`). Correct pattern.
- All I/O via `Fs`/`Path`/`Watcher` services — layer boundary respected.

### `client/src/services/config-validation.ts`
**Path:** client/src/services/config-validation.ts **Purpose (one line):** Zod schemas + Result-based validators for AppConfig sections and cross-field rules, plus a ZodError formatter. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
None found. (The `Err(result.error)` / `Ok(result.data)` shape is the house Result pattern applied to safeParse — fine.)

#### Minor / style
- Lines 116-185: seven per-section validators (`validateCoreConfig`, …, `validateStoresConfig`) are exported but nothing composes them — `validateAppConfig` runs the whole schema in one shot. Dead public API surface; delete until a caller appears.
- Line 19: `z.record(z.never(), z.never())` rejects any preferences entry — consistent with `Record<never, never>`, but a plain `z.object({}).strict()` (or just dropping the section until it has fields) would say the intent more plainly. Works either way.
- Line 57: `gnupg_home: z.string().optional()` accepts empty string, unlike every other string field which gets `.min(1)`. If empty-string `gnupg_home` is meaningless (it is — it would produce `GNUPGHOME=`), add `.min(1)` for consistency.

#### Confirmed correct
- Cross-field `superRefine` for `active_store ∈ stores.keys` and non-empty stores — good trust-boundary validation.
- `formatZodError` handles empty-path issues — fine.

### `client/src/lib/toml.ts`
**Path:** client/src/lib/toml.ts **Purpose (one line):** Thin wrapper over @ltd/j-toml providing Result-based parse/stringify, comment-preserving round-trips, and the commented default-config template builder. **Verdict:** Clean

#### Critical bugs
None found. (Note: the "flattening bug" referenced by config.ts's debug scaffolding likely lives near `toSectionFormat`/`TOML.Section` detection in `stringify` — nothing provably broken from this file alone.)

#### Design issues
None found.

#### Minor / style
- `extractCleanData` recursion assumes arrays contain scalars or tables; an array-of-arrays would hit `extractCleanData(arrayAsTable)` and come back as an index-keyed object. Current schema (`gpg.opts: string[]`) can't trigger it — fine to leave.
- `stringify` overload set: the middle overload (line 148) types *any* ReadonlyTable as `TomlStringified<TData>` with an unbound `TData`, making the brand advisory rather than enforced. By design for internal use; just don't export wider than needed.
- `buildDefaultConfigTable` hardcodes the full AppConfig shape — a new config field won't get a comment automatically. Acceptable: the compiler forces the value into `DEFAULT_CONFIG`; comments are cosmetic.

#### Confirmed correct
- `wrapThrowable(TOML.stringify/parse)` instead of try/catch — exactly the house pattern for taming throwing third-party APIs.
- Symbol-key filtering in `extractCleanData` via `Object.keys` (which skips symbols) — correct way to strip j-toml metadata.
- `bigint: false` in parse keeps numbers as `number`, matching the Zod number schemas downstream.

### `client/src/types/toml.ts`
**Path:** client/src/types/toml.ts **Purpose (one line):** Type-level TOML machinery — TomlObject/TomlValue mapping, raw Table alias, branded TomlStringified, ParsedToml carrier. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- `TomlValue` maps `null` through `Stringifiable` (includes null) but `TomlObject`'s doc comment claims functions/undefined rejection only; behavior is right, docs slightly under-describe. Not worth churn.
- Only `ParsedToml`, `TomlObject`, `TomlStringified` are exported while `Table` is duplicated locally here *and* in lib/toml.ts:9. Two private copies of the same alias is harmless but one shared non-exported import would be tidier.

#### Confirmed correct
- Type-only file, zero runtime imports beyond `import type` — no layer-boundary concerns possible.

### `client/src/types/config.ts`
**Path:** client/src/types/config.ts **Purpose (one line):** Static AppConfig shape, section/key/value helper generics for the typed accessor API. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- `PreferencesConfig = Record<never, never>` (line 11) plus `preferences?:` on AppConfig — placeholder section with no fields. YAGNI-flavored: either give it fields or drop it until it earns existence. Harmless since validation enforces emptiness too.
- `GenerationConfig.memorable` exists here and in DEFAULT_CONFIG/validation, but `buildDefaultConfigTable` has no comment entry for it (toml.ts:98-106) — generated default TOML lacks the doc comment other fields get. Cosmetic drift between three files describing the same schema.

#### Confirmed correct
- Pure type file; `ConfigSection`/`ConfigKey`/`ConfigValue` derived from `AppConfig` (no parallel hand-maintained unions) — single source of truth, good.

## Batch Summary
- Files reviewed: 5 / 5
- Critical bugs: config.ts — `setValue`/`removeValue` mutate `_raw` but `save()` validates the stale `data` snapshot, so written values bypass Zod validation; an invalid write (empty `active_store`, removed active store) bricks config loading on next startup.
- Design issues worth escalating: config.ts `ensure()` treats an `exists()` *error* as "missing" and writes defaults over a possibly-real config (data-loss path); discarded `Watcher.watch` Result in `load()`; `getValue` can return `Ok(undefined)` typed as required.
- Cross-cutting patterns in THIS batch only: clean family overall — Result discipline held everywhere, zero try/catch, zero layer violations; the one systemic weakness is the `_raw` vs `data` duality in ParsedToml: two representations of the same document that mutation updates out of sync, and only `save()`'s validator position exposes it.
- Open questions (needs owner decision, not a guess): (1) Is the "[config-debug]" flattening bug still under investigation? The debug stack-capture in `save()` is the only observability into it — removal should wait for root-cause confirmation. (2) Intended semantics when `Fs.exists` errors in `ensure()`: fail closed (return Err) or current fail-open-with-write? Owner should pick deliberately given the overwrite risk.
