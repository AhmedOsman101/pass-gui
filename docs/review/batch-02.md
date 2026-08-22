# Batch Review: 2 of 10
**Files:** client/src/services/pass.ts · client/src/services/entries.ts · client/src/lib/parse-pass-show.ts · client/src/lib/entry-content.ts · client/src/types/entries.ts · client/src/lib/shell.ts · client/src/lib/errors.ts
**Composition:** slice/family (pass CLI + entries domain: shell lib → services → parser → types)
**Reviewer:** subagent-2

## House Style Reference (restate in own words)
- Result<T,E> contract and where try/catch is allowed: All services return `Result<T,E>` from lib-result, chained via `.match()`/`.andThen()`/`.mapErr()`; `try/catch` exists only in logger/watcher infra.
- Store purity rules: Pinia setup stores must not import toast, router, or DOM APIs; error state is canonically `Ref<Error | null>`.
- Component error handling: components consume Results via `useNotifyResult(...)` / `.match(...)`; raw sonner imports only in App.vue and EntryDetail.vue (documented exceptions).
- Layer boundary rule: all I/O (filesystem, pass, gpg, clipboard, config, etc.) lives in `services/`; components/stores never call Neutralino directly.

## Per-file reviews

### `client/src/services/pass.ts`
**Path:** services/pass.ts **Purpose (one line):** Singleton service detecting the `pass` binary, checking its version, and executing commands with `PASSWORD_STORE_DIR`/`GNUPGHOME` scoping. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **Silent swallow of init errors conflates "not initialized" with "check failed".**
  ```ts
  const result = await this.checkInitialized(this.storePath);
  if (result.isError()) {
    this.isInitialized = false;
    return Ok(false);
  }
  ```
  pass.ts:66–70. A filesystem failure reading `.gpg-id` (permissions, Neutralino fault) is reported as `Ok(false)` — indistinguishable from "no store configured". The caller cannot tell a healthy-but-uninitialized state from a broken environment. **Fix:** propagate the error (`return Err(result.error)`) or add a distinct result shape; at minimum log via logger infra.
- **Config loaded on every single exec call.**
  ```ts
  const configResult = await Config.load();
  if (configResult.isOk()) { ... }
  ```
  pass.ts:201. Every entry operation pays a config read + parse just to wire gpg opts. If `Config.load()` caches internally this is moot — otherwise cache the opts at init/store-switch time. Also: a failed load here is silently ignored (acceptable degradation, but worth a comment).
- **`this.version` mutated in place as shared mutable state** (pass.ts:104–108). Concurrent `checkVersion()` calls or a later unparsable version string leave stale values that `valid` is computed against. Prefer returning a fresh `Version` instead of mutating service state.

#### Minor / style
- Unparsable `--version` output silently yields `{major:0,...}` → `valid:false` with no diagnostic (pass.ts:101–108). An unparsed-version case deserves an Err branch.
- `PassExecError` duplicates `cause` as both built-in Error cause and a public field (pass.ts:26–35).
- Dead branch: if `Neu.exec` already converts non-zero exit codes to `Err`, the `cmdResult.ok.exitCode !== 0` check (pass.ts:90) is unreachable — harmless, but confirm intent.
- Module-level side effect `const passInitialized = Pass.init();` (pass.ts:221) — mitigated because `main.ts:22` awaits it before app start; fine, but fragile if any new import path uses `Pass` before that await.

#### Confirmed correct
- Returning `Result` from all methods, no try/catch — matches house brief.
- `validatePath` on every arg before exec — good trust-boundary hygiene.

---

### `client/src/services/entries.ts`
**Path:** services/entries.ts **Purpose (one line):** Static CRUD facade over `pass show/insert/generate/rm/mv` mapping stderr into typed read/write errors. **Verdict:** Needs fixes

#### Critical bugs
None found.

#### Design issues
- **`generate()` accepts `length` and `symbols` options and never uses them.**
  ```ts
  static async generate(
    path: string,
    options?: {
      length?: number;
      symbols?: boolean;
      memorable?: boolean;
    }
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    ...
      result = await Pass.exec(["generate", "-f", path]);
  ```
  entries.ts:189–204. Non-memorable generation always runs bare `pass generate -f <path>`, ignoring the advertised length/symbols — users asking for 32-char symbols-free passwords get pass's default. This silently violates the function's contract. **Fix:**
  ```ts
  const args = ["generate", "-f"];
  if (options?.symbols === false) args.push("-n");
  args.push(path);
  if (options?.length) args.push(String(options.length));
  result = await Pass.exec(args);
  ```
- **`generate()` force-overwrites existing entries without consent while `insert()` respects `force`.** `["generate", "-f", ...]` destroys an existing secret silently; `insert({force:false})` correctly errors on "already exists". Inconsistent data-safety semantics across sibling mutations. At minimum document why `-f` is required (interactive overwrite prompt would hang), ideally pre-check existence like `edit()` does.
- **`copy()` round-trips plaintext through JS instead of using `pass cp`.**
  ```ts
  const showResult = await Entries.show(oldPath);
  ...
  const insertResult = await Entries.insert({
    path: newPath,
    content: showResult.ok.raw,
    force: false,
  });
  ```
  entries.ts:235–243. Decrypts, holds the secret in JS memory, then re-encrypts via `insert -m`. `Pass.exec(["cp", oldPath, newPath])` does it inside pass, avoids the plaintext hop and the parse/re-serialize fidelity risk, and halves the failure surface. Same pattern in `edit()` (show-as-existence-check) — a cheap `Fs.exists` on `<store>/<path>.gpg` would avoid decrypting to test existence.

#### Minor / style
- `EntriesReadError` and `EntriesWriteError` are byte-identical classes (entries.ts:23–62); likewise `mapReadError`/`mapWriteError` overlap heavily. The "distinct type per family" rationale is documented, but one class + a `family` field would do.
- `move()` attributes failures to `newPath` even when the failure concerns `oldPath` (entries.ts:258).
- `MutationResult.success` is always literal `true` — dead field.
- `Entries` is a static-class namespace while `Pass` is a singleton instance — pick one idiom within services/.

#### Confirmed correct
- Result-returning, throw-free design with stderr-derived error kinds — matches house brief.
- `list()` delegating to `walkStore` (filesystem walk, no `pass ls` parsing) is documented intent, not a layer violation.

---

### `client/src/lib/parse-pass-show.ts`
**Path:** lib/parse-pass-show.ts **Purpose (one line):** Pure parser turning `pass show` stdout into `EntryDetail` (secret + metadata map + other lines). **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **Second divergent parser of the same format exists in this batch.** `parsePassShowOutput` vs `lib/entry-content.ts#parseEntryContent` implement the same grammar with different output shapes (`Record`+`other[]` vs `MetadataEntry[]`+`otpUri`+`notes`) and different rules: this file applies `stripInlineComment` and pushes OTP URIs to `other`; entry-content extracts `otpUri` and strips nothing. They will drift further. **Fix:** make one canonical line-parser and derive both shapes, or delete one if consumers can share `EntryDetail`.

#### Minor / style
- The `hasOtpUri` flag changes nothing: first and subsequent OTP URIs both go to `other` (parse-pass-show.ts:36–45) — dead branching; simplify to `line.startsWith("otpauth://")`.
- `\r\n` output would leave trailing `\r` on every parsed value (`trimmed.split("\n")`). Cheap guard: split on `/\r?\n/`.
- Metadata keys are case-sensitive (`URL:` vs `url:` coexist) — probably fine for pass semantics, noting only.

#### Confirmed correct
- Empty-output → `Err(EntryParseError)` rather than a fabricated empty secret — good.
- `colonIndex > 0` correctly sends key-less lines to `other`.

---

### `client/src/lib/entry-content.ts`
**Path:** lib/entry-content.ts **Purpose (one line):** Bidirectional draft codec: raw entry text ↔ `EntryDraft` (secret, otpUri, metadata array, notes). **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- Duplicate-format-parser problem as above (see parse-pass-show.ts review) — this is the other half. Additionally the two disagree on inline comments: this codec preserves them verbatim on serialize, so an entry edited through the draft flow after being read via `parsePassShowOutput` (which strips comments) loses them. Whichever direction is intended, it should be stated once.

#### Minor / style
- No `\r\n` tolerance in `split("\n")` — same as the sibling parser.
- Trailing newline in `raw` becomes a trailing empty note line, re-emitted on serialize — cosmetic churn on round-trip.
- `serializeEntryContent` keeps an empty secret as a leading blank line when otpUri/metadata exist; correct for round-trip but worth a comment since it looks accidental.

#### Confirmed correct
- Round-trip property holds: `serialize(parse(raw))` is stable including the leading-empty-line case I traced.
- Filtering empty otpUri/notes lines on serialize is symmetric with its own parse.

---

### `client/src/types/entries.ts`
**Path:** types/entries.ts **Purpose (one line):** Domain type contracts for tree nodes, entry details, mutations, and clipboard state. **Verdict:** Clean

#### Critical bugs
None found.

#### Design issues
None found.

#### Minor / style
- Stale doc on `EntryDetail.path`: says "set by the caller after parsing", but `parsePassShowOutput` sets it from its argument (types/entries.ts:32).
- `MutationInput.force?: boolean` optional vs always supplied explicitly at call sites — could be required now; not worth churn alone.

#### Confirmed correct
- `ClipboardSelection` doc acknowledging Neutralino-only `"clipboard"` support matches reality; union type kept for forward-compat is deliberate.
- Types-only module, no runtime imports — correct placement in types/.

---

### `client/src/lib/shell.ts`
**Path:** lib/shell.ts **Purpose (one line):** Shell quoting/validation helpers plus path-traversal checks used by the neutralino exec wrapper. **Verdict:** Needs fixes

#### Critical bugs
- **Windows quoting mangles backslashes in exactly the wrong places.**
  ```ts
  case "\\":
    result += "\\";
    prevChar = char;
    break;
  ...
    default:
      if (prevChar === "\\") {
        result += "\\";
      }
      result += char;
      prevChar = char;
  ```
  shell.ts:33–46. Two inversions of the MSVCRT rule ("double backslashes *only* when they immediately precede a double quote"): (1) a backslash run before a normal character gets doubled — `C:\Users` emits `C:\\Users`; (2) a backslash immediately before a `"` gets no doubling, so `a\"b` emits `\""` which CommandLineToArgvW parses as escaped-quote + quoting toggle — the argument boundary breaks. Worst case, an argument ending in `\` produces `"C:\"` where the closing quote is consumed as escaped, corrupting the command line. All execs route through `buildShellCommand` (services/neutralino.ts:93), so any Windows user path containing backslashes is affected. **Fix:** count the pending backslash run and emit `run*2` backslashes immediately before each embedded `"`:
  ```ts
  let backslashes = 0;
  for (const char of arg) {
    if (char === "\\") { backslashes++; continue; }
    if (char === '"') {
      result += "\\".repeat(backslashes * 2) + '""';
    } else {
      result += "\\".repeat(backslashes) + char;
    }
    backslashes = 0;
  }
  result += "\\".repeat(backslashes);
  return `"${result}"`;
  ```

#### Design issues
- **Security check fails open.**
  ```ts
  const normalizedResult = await Fs.getNormalizedPath(path);
  if (normalizedResult.isError()) return false;
  ```
  shell.ts:118–119. A normalization error makes `checkSneakyPath` report "safe", skipping traversal detection. Trust-boundary checks should fail closed: `return true` (treat as sneaky) on error, letting `validatePath` reject with the generic message.
- **Layer inversion: `lib/` importing from `services/`.**
  ```ts
  import { Fs } from "@/services/filesystem";
  ```
  shell.ts:2. House rule puts I/O in services, which this respects literally, but the dependency arrow runs backwards (services/pass → lib/shell → services/filesystem), one step from a cycle. The normalization input here is a *string*; a pure `../`-pattern check needs no filesystem call at all.

#### Minor / style
- `checkSneakyPath` false-positives on legit names like `..backup` or `foo/..hidden` (`includes("/..")`, `startsWith("..")`). Safe-direction bias, fine to keep, but worth a comment.
- `endsWith("/..")` is redundant given `includes("/..")`.

#### Confirmed correct
- POSIX single-quote wrapping with `'\\''` escaping is correct.
- `validateCommand` rejecting quotes/newlines/dashes/null bytes for the command name is right; args legitimately don't need quote rejection since POSIX quoting handles them.

---

### `client/src/lib/errors.ts`
**Path:** lib/errors.ts **Purpose (one line):** Central error taxonomy: Neutralino code maps, config/store/entry/version/command-failure error classes. **Verdict:** Minor issues

#### Critical bugs
None found.

#### Design issues
- **`CommandFailedError` stores fabricated args and builds a malformed message.**
  ```ts
  `Command failed: ${opts.cmd}${opts.args?.join(" ")} (exit code ${opts.exitCode})`,
  ...
  if (opts.args) {
    this.args = opts.args.length === 0 ? [" "] : ["", ...opts.args];
  }
  ```
  errors.ts:254–267. The message renders as `Command failed: passshow foo (exit code 1)` — no space between cmd and args. Worse, the public `args` field is rewritten: zero args become a phantom `[" "]` and real args get a spurious `""` prepended — downstream consumers matching on `err.args` see arguments that were never executed. Looks like a leftover hack to compensate for the missing space. **Fix:**
  ```ts
  `Command failed: ${opts.cmd}${opts.args?.length ? " " + opts.args.join(" ") : ""} (exit code ${opts.exitCode})`,
  ...
  if (opts.args) this.args = [...opts.args];
  ```

#### Minor / style
- `ConfigParseError.parseError: Error | null` but constructor requires `Error` — nullability unreachable (errors.ts:148–150); same pattern done right in `ConfigValidationError.zodError`.
- Grab-bag scope (neu/config/store/command/entry/version codes in one file) — acceptable as central registry, but ~340 lines and growing; consider splitting per domain when next touched.
- `NEU_ERROR_CODES_MAP` cast-through-Object.fromEntries typing is fine and correctly frozen.

#### Confirmed correct
- Errors extend `Error` with structured `code`/`type` fields and use `ErrorOptions.cause` — consistent with the Result-carried-error style; no try/catch present in this file.
- Frozen `as const` maps with derived key/value unions are idiomatic.

## Batch Summary
- Files reviewed: 7 / 7
- Critical bugs: `shell.ts` — Windows backslash/quote doubling inverted, breaking argument boundaries (all execs route through it); `errors.ts` CommandFailedError args-mangling is adjacent but classified Needs-fixes/design.
- Design issues worth escalating: `entries.ts generate()` ignoring length/symbols options (silent contract violation); `copy()` plaintext round-trip instead of `pass cp`; duplicate divergent pass-format parsers (`parse-pass-show.ts` vs `entry-content.ts`); fail-open `checkSneakyPath`; silent init-error swallowing in `pass.ts`.
- Cross-cutting patterns in THIS batch: two parsers + two near-identical error-class pairs + duplicated stderr-mapping logic — the entries domain has parallel implementations everywhere; consolidation candidates. Services consistently honor the Result contract (no try/catch, no thrown paths) — house style well followed.
- Open questions (needs owner decision): (1) Is Windows a supported target? Determines severity/urgency of the `quoteForWindows` fix. (2) Does `generate -f` need to stay force-by-default because non-interactive `pass generate` hangs on the overwrite prompt? If so, document it and pre-check existence instead. (3) Should inline comments be stripped (parse-pass-show) or preserved (entry-content) as the canonical read behavior?

**Note:** This was a read-only review; no files were created or modified.