# Batch Review: 7 of 10
**Files:** client/src/services/gpg.ts, client/src/services/readiness.ts, client/src/stores/readiness.ts, client/src/lib/readiness-helper.ts, client/src/types/readiness.ts, client/src/components/readiness/ReadinessGate.vue, client/src/components/readiness/BlockedScreen.vue, client/src/components/readiness/IssueCard.vue, client/src/components/readiness/LoadingScreen.vue
**Composition:** vertical slice family (gpg + readiness domains)
**Reviewer:** subagent-7

## House Style Reference (restate in own words)
- Result<T,E> contract: every fallible services/stores function returns lib-result's Result, chained via .match/.andThen/.mapErr; errors are values, never thrown — try/catch exists only in logger/watcher infra.
- Store purity: Pinia setup stores hold reactive state + call services only; no toast/router/DOM imports; failures surface as `Ref<Error | null>` — the sanctioned pattern.
- Component error handling: components unwrap Results with useNotifyResult(...) or .match(...); raw sonner imports are bugs except App.vue and EntryDetail.vue (documented); a third direct sonner import is a finding.
- Layer boundary: all filesystem/process/env/config I/O lives in services/*; components and stores must never touch `Neutralino.*` directly.

## Per-file reviews

### `client/src/services/gpg.ts`
**Path:** client/src/services/gpg.ts **Purpose:** GPG binary detection, version validation, secret-key listing/parsing, generic gpg exec. **Verdict:** Needs fixes

#### Critical bugs
1. Stale version reported as valid when output is unparseable.
```ts
const versionMatch = output.match(/gpg \(GnuPG\) (\d+)\.(\d+)\.(\d+)/) as string[] | null;
if (versionMatch) { ... }
...
return Ok({
  valid: compareVersions(this.version, GPG_MIN_VERSION) >= 0,
  found: this.version,
```
(gpg.ts:138–160) If the regex misses (localized/unexpected `gpg --version` output), `this.version` keeps whatever a previous call set — or zeros — and the method still returns `Ok`. On the shared singleton, a second `checkVersion()` after one success can report the *old* binary's version as current. Fix:
```ts
this.version = { major: 0, minor: 0, patch: 0 };
if (!versionMatch) {
  return Err(new VersionCheckError(false, this.version, GPG_MIN_VERSION, "Unparseable gpg --version output"));
}
```

#### Design issues
1. Import-time fire-and-forget I/O side effect.
```ts
const Gpg = new GpgService();
const gpgInitialized = Gpg.init();
```
(gpg.ts:336–337) A process probe starts the moment the module is imported. Any consumer calling `listSecretKeys()` before it settles silently runs under the `"gpg"` default from `getCommand()`, and nothing in this batch awaits `gpgInitialized`. Fix: make init idempotent inside first use (`if (!this.initialized) await this.init()`) and drop the module-level call.
2. Mutable singleton state (`command`, `homeDir`, `version`) mutated across calls by `init()`/`checkVersion()`/`setHome()`. Interleaved flows with different GNUPGHOMEs don't corrupt each other today only because `listSecretKeysWithHome` passes GNUPGHOME explicitly — fragile coupling; return resolved values instead of stashing them where feasible.
3. `public cause: Error | null` (gpg.ts:27) shadows ES2022's built-in `Error.cause`; drop the field and rely on `super(message, { cause })`.

#### Minor / style
- `.split("T")[0] ?? null` (gpg.ts:313) — index 0 of split is always defined; dead `?? null`.
- Unnecessary `as string[] | null` cast (gpg.ts:138).
- Windows fallback logs resolution but POSIX paths don't — inconsistent debug logging.
- `checkVersion` error path conflates exec failure with version failure into one `VersionCheckError`; acceptable but lossy.

#### Confirmed correct
- All methods return `Result<T,E>`, zero try/catch — house style.
- Direct `@neutralinojs/lib` usage is correct here: this *is* the service layer that owns I/O.
- `cmdResult.ok?.stdErr` inside the `isError() || exitCode !== 0` block (gpg.ts:131) looks like unsafe Err access but `.ok` legitimately exists in the exitCode branch — correct.
- Colon-format parser field indices (sec:4=keyid, sec:3=algo, uid/fpr:9) match `--with-colons` spec; `fpr` gated on `lastRecordType === "sec"` correctly avoids grabbing subkey fingerprints.

### `client/src/services/readiness.ts`
**Path:** client/src/services/readiness.ts **Purpose:** Orchestrates ordered dependency checks (pass → tree → gpg → keys → store) into a ReadinessSnapshot. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
1. Keyring failure mislabeled as parse error, under wrong state.
```ts
if (verification.isError()) {
  return {
    ...OK,
    state: "STORE_GPG_ID_KEY_MISSING",
    issues: [
      issue("STORE_GPG_ID_PARSE_ERROR", {
        path: gpgIdPath,
        parseError: verification.error,
      }),
    ],
```
(readiness.ts:222–234) `verifyRecipients` errs when the keyring listing fails (`GpgKeyListError`: exec crash, bad GNUPGHOME) — parsing already succeeded two lines up. The user gets IssueCard's "Cannot parse .gpg-id / check the file format" advice for a broken keyring. Fix: emit a distinct issue code for keyring-listing failure carrying the real message.
2. `hasEntries` Err swallowed silently.
```ts
const hasEntries = await StoreValidation.hasEntries(storePath);
if (hasEntries.isOk() && !hasEntries.ok) { ... }
return OK;
```
(readiness.ts:277–287) A failed directory read (permissions, transient IO) reports READY and drops the error branch on the floor — unhandled Err dropped silently per the brief. At minimum log it or emit an info issue.
3. Eager parallel start vs. documented strict order.
```ts
const checks = [
  Readiness.checkPass(),
  Readiness.checkTree(),
  ...
];
for (const result of checks) { ... await result ... }
```
(readiness.ts:42–54) Invoking each check builds its promise immediately, so all five probes start concurrently while results are consumed serially — the docblock's "strict order" isn't enforced and short-circuiting doesn't skip work. Harmless while checks are read-only; fix by storing thunks and invoking in-loop.

#### Minor / style
- `checkPass` maps probe *errors* to PASS_BINARY_MISSING — conflates "not installed" with "couldn't probe"; acceptable UX, deserves a comment.

#### Confirmed correct
- Every `issue(...)` call's context fields match its union variant exactly (spot-checked all, incl. `parseError: Error` and multi-issue `missingKeys.map`).
- No try/catch, no direct Neutralino calls — all I/O routed through Pass/Fs/Gpg/Neu/Config/StoreValidation services.

### `client/src/stores/readiness.ts`
**Path:** client/src/stores/readiness.ts **Purpose:** Setup store hydrating reactive readiness state from the orchestrator. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- Blocking-filter logic duplicated inline in `evaluate` (line 55) instead of reusing the exported `blockingIssues` computed (line 32).

#### Confirmed correct
- `error = ref<Error | null>(null) as Ref<Error | null>` — exactly the canonical store-error pattern from the brief.
- `wrapAsync` instead of try/catch — matches Result contract.
- Imports are pinia/vue/logger/services/types only — no toast, router, or DOM APIs; Logger is permitted infra.

### `client/src/lib/readiness-helper.ts`
**Path:** client/src/lib/readiness-helper.ts **Purpose:** Type-safe factory constructing ReadinessIssue variants with canonical severity mapping. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
None found.

#### Confirmed correct
- `return { code, severity: SEVERITY[code], ...fields } as ReadinessIssue` — cast is unavoidable given spread typing against a discriminated union; safety is enforced upstream by the mapped `IssueFields<C>` type.
- Severity table is `Record<ReadinessIssueCode, ...>` so adding a variant without a mapping is a compile error — exhaustive by construction.

### `client/src/types/readiness.ts`
**Path:** client/src/types/readiness.ts **Purpose:** State machine states, discriminated issue union, snapshot and VersionCheck types. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
None found.

#### Confirmed correct
- Pure type module, single type-only import — correctly placed in types/.
- All 13 variants' severity literals agree with the SEVERITY table in readiness-helper.ts (verified pairwise).

### `client/src/components/readiness/ReadinessGate.vue`
**Path:** client/src/components/readiness/ReadinessGate.vue **Purpose:** Gate component: loads active store, evaluates readiness, routes between loading/blocked/app slot. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
1. Unguarded concurrent evaluates.
```ts
onMounted(async () => {
  await activeStore.load();
  const storePath = activeStore.storePath;
  if (storePath) await readiness.evaluate(storePath);
});
watch(
  () => activeStore.storePath,
  async (newPath) => { if (newPath) await readiness.evaluate(newPath); }
);
```
(ReadinessGate.vue:16–35) If `activeStore.load()` sets/changes `storePath`, both the mount path and the watcher fire `evaluate` concurrently; `evaluate` never checks `isEvaluating` before running, so interleaved runs race on `snapshot`/`error`. Benign today (last write wins, same input) but a cheap guard in the store (`if (isEvaluating.value) return`) closes it.

#### Minor / style
- If `activeStore.load()` fails (no store configured), the gate falls through to BlockedScreen with zero issues — screen shows only header + retry button whose handler no-ops (`activeStore.storePath` falsy). Works, but the retry affordance is dead in exactly that state.

#### Confirmed correct
- Uses stores + child components only; no services called directly beyond the store API, no sonner, no Neutralino, no try/catch.

### `client/src/components/readiness/BlockedScreen.vue`
**Path:** client/src/components/readiness/BlockedScreen.vue **Purpose:** Full-screen blocker showing primary issue, aggregate count, store/readiness errors, retry. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- Retry click `activeStore.storePath && readiness.evaluate(...)` silently no-ops without a store path — a disabled state would explain why clicking does nothing.
- Only primary issue visible plus "+N more issue(s)" count; remaining issues unreachable. Presumably deliberate minimalism — observation, not defect.

#### Confirmed correct
- Reads `readiness.error` / `activeStore.error` (canonical store `Ref<Error|null>`) inline for display — no Results involved, so useNotifyResult doesn't apply; not a violation.
- No sonner import, no Neutralino import, no try/catch.

### `client/src/components/readiness/IssueCard.vue`
**Path:** client/src/components/readiness/IssueCard.vue **Purpose:** Renders one readiness issue with human-readable title/description/action. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- `issueDisplay: Record<string, ...>` (IssueCard.vue:15) should be keyed `Record<ReadinessIssueCode, ...>` — the derived union already exists; typed keys turn "new variant added without display copy" into a compile error instead of a runtime fallback.
- Fallback title renders `props.issue.code` verbatim (IssueCard.vue:96), contradicting the docblock "never raw error codes in the UI". Currently unreachable since all 13 codes have entries; typing the record makes it provably unreachable.
- Context fields (`path`, `keyId`, `found`/`expected` versions, `stderr`) are never displayed despite being carried in the union — e.g. STORE_RECIPIENT_UNKNOWN says "a key ID was not found" without naming which one. Missed value, minor.

#### Confirmed correct
- Pure presentational: props in, markup out; no store, service, toast, or I/O.

### `client/src/components/readiness/LoadingScreen.vue`
**Path:** client/src/components/readiness/LoadingScreen.vue **Purpose:** Skeleton placeholder during evaluation. **Verdict:** Clean

Nothing to find. 13 lines, one UI-kit import.

## Batch Summary
- Files reviewed: 9 / 9
- Critical bugs:
  - gpg.ts — `checkVersion` returns stale singleton version data as a successful `Ok` when `--version` output is unparseable
- Design issues worth escalating:
  - readiness.ts — keyring-listing failure misreported as STORE_GPG_ID_PARSE_ERROR ("Cannot parse .gpg-id") under state STORE_GPG_ID_KEY_MISSING
  - readiness.ts — `hasEntries` Err silently swallowed → app reports READY on read failure
  - gpg.ts — module-import-time `Gpg.init()` fire-and-forget plus mutable singleton state (`command`/`homeDir`/`version`)
  - gpg.ts — `GpgKeyListError.cause` shadows built-in `Error.cause`
- Cross-cutting patterns in THIS batch: consistent Result chaining with zero try/catch; clean services→store→component layering with no Neutralino leakage outside services/; issue-code/severity/type tables kept mutually consistent across types/helper/service/UI; components consume errors exclusively via canonical store `Ref<Error|null>` — no third sonner import anywhere.
- Open questions (needs owner decision):
  - Readiness never calls `Gpg.checkVersion()` even though `GPG_VERSION_TOO_OLD` exists in the issue union, SEVERITY table, and IssueCard — intentional deferral or missing check?
  - Is `readiness-helper.issue()`'s spread order (fields could theoretically override `code`/`severity` at runtime despite types) accepted as-is, given the cast?
