# Release Phase — Implementation Plan

> **Spec**: `docs/specs/release.md`
> **Roadmap**: `docs/roadmap/05-release-and-future-work.md`
> **Depends on**: Phase 02 (readiness), Phase 03 (entry ops), Phase 04 (frontend UI) completely implemented

## Goal

Harden, package, and document the app for distribution. No new features. Work is: removing the remaining module-level init promise exports (`gpgInitialized` from `gpg.ts`, `passInitialized` from `pass.ts`), adding lazy init guards to all affected service methods, verifying all critical paths work on a real store, creating a repeatable release build, writing user documentation under `docs/wiki/`, and updating project documentation to reflect the completed state.

**Note**: `main.ts` has already been cleaned in Phase 02 — only `neuInitialized` is imported/awaited. The focus is on `gpg.ts` and `pass.ts` init removal.

## Prerequisites

- Phase 04 frontend is complete: all UI flows work against stable backend contracts
- `ReadinessStore` correctly drives app entry (blocked vs. ready states)
- `EntriesService` and `ClipboardService` are wired through Pinia stores
- Entries can be listed, viewed, created, generated, and removed from the UI
- Clipboard copies passwords and clears after configured delay
- Settings page can read and write config values
- `pnpm build` produces a working production build (Vite + NeutralinoJS)
- Project is at a usable MVP state

## New Types Required

None. This phase adds no new TypeScript types.

## New Files to Create

### 1. `docs/wiki/system-requirements.md`

**Responsibility**: Document OS, runtime, and tool requirements for running pass-gui.

### 2. `docs/wiki/installation.md`

**Responsibility**: Installation guide covering binary download, build-from-source, and first-launch setup.

### 3. `docs/wiki/configuration.md`

**Responsibility**: Complete config file reference with all sections, keys, defaults, and cross-field validation rules.

### 4. `docs/wiki/troubleshooting.md`

**Responsibility**: Common problems and their solutions (missing pass, missing GPG keys, invalid store, clipboard issues), each with actionable steps.

### 5. `docs/wiki/keyboard-shortcuts.md`

**Responsibility**: Document all implemented keyboard shortcuts.

## Files to Modify

### 1. `client/src/services/gpg.ts`

**Remove** (lines 265-267):
- Remove `const gpgInitialized = gpg.init();` module-level side effect.
- Remove `gpgInitialized` from the export statement.
- Export becomes: `export { gpg, GpgService };`

**Lazy init guard**: After removing the module-level `gpg.init()`, add a lazy init check inside methods that depend on `this.command` being populated:

```ts
// Pattern for exec(), listSecretKeys(), validateGpgBinary(), listSecretKeysWithHome():
if (!this.command) {
  const result = await this.gpgExists();
  if (result.isError() || !result.ok) {
    return ErrFromText("GPG binary not resolved");
  }
}
```

The readiness orchestrator calls `gpg.gpgExists()` as its first GPG step, which populates `this.command`. The lazy guard handles cases where GPG methods are called before the readiness pipeline runs.

**Methods needing lazy init guard**: `exec()`, `listSecretKeys()`, `listSecretKeysWithHome()`, `validateGpgBinary()`.

### 2. `client/src/services/pass.ts`

**Remove** (lines 172-174):
- Remove `const passInitialized = pass.init();` module-level side effect.
- Remove `passInitialized` from the export statement.
- Export becomes: `export { pass, PassService };`

**Lazy init guard**: After removing the module-level `pass.init()`, add a lazy init check inside `exec()`:

```ts
// At start of exec(), before the path validation:
if (!this.storeDirectory) {
  const result = await this.init();
  if (result.isError()) {
    return ErrFromText("Pass service not initialized");
  }
}
```

`execScoped()` does NOT need the guard (it receives `PASSWORD_STORE_DIR` as an env parameter, doesn't depend on `this.storeDirectory`).

### 3. `client/src/main.ts`

**Already clean** (no changes needed). Verify:
- Only `import { neuInitialized } from "@/services/neutralino"` imports
- Only `await neuInitialized` remains
- `Neutralino.init()` and `app.mount("#app")` in correct order

### 4. `neutralino.config.json`

**Changes**:
- `"version"`: `"0.0.1"` → `"1.0.0"` (line 9)
- Verify `"applicationName"` is `"Pass GUI"` (correct, line 4)
- Verify `cli.binaryName` is `"pass-gui"` (correct, line 51)
- Verify `"enableNativeAPI"` is `true` (correct, line 19)

### 5. `TODO.md`

**Changes**:
- Mark all Phase 02, 03, 04 items as `[x]`.
- Add a `## Future / Post-Release` section at the bottom with deferred items.
- Consolidate redundant entries.

### 6. `docs/roadmap/README.md`

**Changes**: Add note that all 5 roadmap phases are complete. Link to future work tracking in `TODO.md`.

### 7. `docs/README.md`

**Changes**: Update phase statuses:
- Phase 02: "📋 Ready to implement" → "✅ Done"
- Phase 03: "📋 Planned" → "✅ Done"
- Phase 04: "📋 Planned" → "✅ Done"
- Phase 05: "📋 Planned" → "✅ Done"

### 8. `AGENTS.md`

**Changes**: Update "Current Project Reality" to reflect the completed state. Remove references to planned/gap items that are now implemented. Keep architecture patterns, code style rules, and security guidance.

## Implementation Steps

### Step 1: Remove module-level init side effects from gpg.ts

**File**: `client/src/services/gpg.ts`

**Changes**:
1. Remove `const gpgInitialized = gpg.init();` (line 265).
2. Remove `gpgInitialized` from the export (line 267).
3. Export becomes: `export { gpg, GpgService };`
4. Add lazy init guard to `exec()` method: at start, `if (!this.command) { const result = await this.gpgExists(); if (result.isError() || !result.ok) { return ErrFromText("GPG binary not resolved"); } }`
5. Add same lazy init guard to `listSecretKeys()`, `listSecretKeysWithHome()`, `validateGpgBinary()`.

**Verify**: No files in the project import `gpgInitialized` (use `rg "gpgInitialized"` to confirm).

### Step 2: Remove module-level init side effects from pass.ts

**File**: `client/src/services/pass.ts`

**Changes**:
1. Remove `const passInitialized = pass.init();` (line 172).
2. Remove `passInitialized` from the export (line 174).
3. Export becomes: `export { pass, PassService };`
4. Add lazy init guard to `exec()` method: at start, `if (!this.storeDirectory) { const result = await this.init(); if (result.isError()) { return ErrFromText("Pass service not initialized"); } }`
5. `execScoped()` does NOT need the guard (receives env as parameters, doesn't depend on `this.storeDirectory`).

**Verify**: No files in the project import `passInitialized` (use `rg "passInitialized"` to confirm).

### Step 3: Verify main.ts is clean

**File**: `client/src/main.ts`

**Already done in Phase 02**. Verify:
- No `import { passInitialized }` or `import { gpgInitialized }` remains.
- No `await gpgInitialized` or `await passInitialized` remains.
- Only `Neutralino.init()` and `await neuInitialized` are present.
- `app.mount("#app")` runs immediately (before the awaits, which is correct Vue 3 behavior).

Run `pnpm typecheck && pnpm lint && pnpm format`.

### Step 4: Perform hardening verification

Walk through every critical path systematically:

1. **Missing pass**: Temporarily remove pass from PATH. Launch app. Verify blocked screen shows `DEPENDENCIES_MISSING` with guidance.
2. **Missing GPG keys**: Ensure pass exists but GPG has no secret keys. Verify `GPG_NOT_INITIALIZED` screen.
3. **Missing store**: Ensure pass and GPG are fine but store path doesn't exist. Verify `STORE_NOT_FOUND` screen.
4. **Invalid store**: Create store without `.gpg-id`. Verify `STORE_INVALID` screen.
5. **Full journey**: With a real store, verify: open → readiness passes → load list → select entry → view detail → copy → clipboard countdown → clear → create entry → generate entry → remove entry.
6. **Config round-trip**: Change config via settings, save, reload app, verify value persists.
7. **Config creation**: Delete config file, launch app, verify config file is auto-generated with defaults.
8. **Clipboard**: Verify auto-clear after timeout. Verify abort button. Verify manual clear.
9. **Search**: Type query, verify tree filters. Clear, verify all entries return.
10. **Dark/light mode**: Toggle, verify all screens render correctly.
11. **Path safety**: Attempt `../../` path traversal in entry path input. Verify rejection.
12. **No plaintext leak**: Inspect console logs, error messages, Pinia devtools — no passwords in plaintext.

### Step 5: Verify build pipeline

1. `pnpm typecheck` — zero errors.
2. `pnpm lint && pnpm format` — zero warnings.
3. `pnpm build:frontend` — produces valid Vite dist at `client/dist/`.
4. `pnpm build` — produces NeutralinoJS binary at `build/pass-gui-{os}_{arch}/`.
5. Run the built binary with `./build/pass-gui-*/pass-gui` (or the platform-specific path).
6. Verify binary shows app correctly (basic smoke test — window opens without crash).

### Step 6: Update neutralino.config.json

1. Change `"version"` from `"0.0.1"` to `"1.0.0"` (line 9).
2. Confirm `"applicationName"` is `"Pass GUI"` (line 4, already correct).
3. Confirm `cli.binaryName` is `"pass-gui"` (line 51, already correct).
4. Confirm `"enableNativeAPI"` is `true` (line 19, already correct).

### Step 7: Write user documentation

Create 5 files under `docs/wiki/`:

**`docs/wiki/system-requirements.md`**:
- Minimum: `pass` >= 1.7.0, `gpg` or `gpg2` (from GnuPG), at least one GPG key pair.
- Linux: primary target, install via `apt install pass` (Debian/Ubuntu), `pacman -S pass` (Arch), etc.
- macOS: pass via Homebrew (`brew install pass`), GPG via GPG Suite or Homebrew.
- Windows: limited support — WSL recommended for pass, GPG4Win for GPG.
- Optional: custom `GNUPGHOME`, pass extensions.

**`docs/wiki/installation.md`**:
- Download binary from releases page (or build from source).
- Build from source: `git clone`, `cd pass-gui`, `pnpm install`, `pnpm build`.
- First launch: config auto-generated at platform-specific config path.
- Store setup prerequisite: `pass init <your-key-id>` from terminal.
- Platform-specific notes (Linux .desktop shortcut, macOS .app bundle).

**`docs/wiki/configuration.md`**:
- Config file location: Linux `~/.config/pass-gui/config.toml`, macOS `~/Library/Application Support/pass-gui/config.toml`, Windows `%APPDATA%/pass-gui/config.toml`.
- All sections in a table: `[core]` (active_store), `[preferences]` (auto_refresh_interval_ms), `[generation]` (default_length, symbols, character_set), `[clipboard]` (clear_after_seconds, selection), `[gpg]` (opts, signing_key, key), `[extensions]` (enabled), `[stores.<name>]` (path, gnupg_home).
- For each key: description, type, default value.
- Cross-field rules: `active_store` must reference a defined store key in `[stores]`.
- Comment preservation behavior: full-line comments may be lost, inline comments preserved.

**`docs/wiki/troubleshooting.md`**:
- "pass not found" → install pass from your package manager.
- "No GPG keys found" → generate keys: `gpg --full-generate-key`.
- "Store not found" → create a store: `pass init <key-id>`.
- "Invalid .gpg-id" → check `.gpg-id` content, verify recipients match GPG keyring.
- "Clipboard not working" → platform limitations (NeutralinoJS only supports system clipboard).
- "App shows blocked screen after setup" → click "Check Again" button.

**`docs/wiki/keyboard-shortcuts.md`**:
- List all implemented keyboard shortcuts (based on actual Phase 04 implementation).

### Step 8: Update project documentation

1. **`TODO.md`**: Mark all Phase 02/03/04 items as `[x]`. Add `## Future / Post-Release` section with deferred items.
2. **`docs/roadmap/README.md`**: Add note at top: "All 5 roadmap phases are complete as of the 1.0.0 release. Future work is tracked in `TODO.md`."
3. **`docs/README.md`**: Update the phase status table:
   - Phase 02: "📋 Ready to implement" → "✅ Done"
   - Phase 03: "📋 Planned" → "✅ Done"
   - Phase 04: "📋 Planned" → "✅ Done"
   - Phase 05: "📋 Planned" → "✅ Done"
4. **`AGENTS.md`**: In the "Current Project Reality" section, update the bullet list to reflect all phases complete. Remove references to planned/gap items. Keep architecture patterns, code style rules, service descriptions, and security guidance intact.

## Integration Points

This phase is the final integration step. There is no Phase 06 within the current roadmap scope:

1. **Phase 01 (config)**: Config creation on first launch, config round-trip verified.
2. **Phase 02 (readiness)**: Blocked states show actionable guidance — verified.
3. **Phase 03 (entry ops)**: Listing, detail, mutations, clipboard all work — verified.
4. **Phase 04 (frontend UI)**: All user flows work end-to-end — verified.
5. **Build pipeline**: `pnpm build` produces distributable binary — verified.
6. **Documentation**: User docs cover setup, usage, and troubleshooting.

Post-release future work is tracked in `TODO.md` but not implemented.

## Verification Checklist

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format` all pass with zero errors/warnings
- [ ] `pnpm build` completes successfully and produces a binary at `build/`
- [ ] Built binary runs outside the development environment
- [ ] Delete config → launch app → config regenerates with defaults on first save
- [ ] App detects pass/GPG/store → shows ready state → loads password list
- [ ] List entries → view detail → copy password → clipboard indicator shows countdown
- [ ] Wait for clipboard clear → clipboard is empty (verify with external tool)
- [ ] Create entry via UI → appears in tree
- [ ] Generate entry via UI → appears in tree
- [ ] Remove entry → disappears from tree, detail panel clears
- [ ] Change config value in settings → relaunch → value persists
- [ ] No plaintext passwords in console logs, error messages, or page state
- [ ] Readiness blocked states each show actionable guidance:
  - `DEPENDENCIES_MISSING`: install pass message
  - `GPG_NOT_INITIALIZED`: generate GPG keys message
  - `STORE_NOT_FOUND`: create store message
  - `STORE_INVALID`: specific issue description
- [ ] `main.ts` only imports and awaits `neuInitialized` — no GPG/pass init promises
- [ ] `gpg.ts` does not export `gpgInitialized`; lazy init guard present in `exec()`, `listSecretKeys()`, `validateGpgBinary()`, `listSecretKeysWithHome()`
- [ ] `pass.ts` does not export `passInitialized`; lazy init guard present in `exec()`
- [ ] No file in the project references `gpgInitialized` or `passInitialized` after cleanup (use `rg` to verify)
- [ ] `docs/wiki/system-requirements.md` written and accurate
- [ ] `docs/wiki/installation.md` written and accurate
- [ ] `docs/wiki/configuration.md` written and accurate
- [ ] `docs/wiki/troubleshooting.md` written and accurate
- [ ] `docs/wiki/keyboard-shortcuts.md` written
- [ ] `TODO.md` reflects completed state with `## Future / Post-Release` section
- [ ] `docs/roadmap/README.md` updated with post-release completion note
- [ ] `docs/README.md` phase statuses set to "Done" for all implementation phases
- [ ] `AGENTS.md` "Current Project Reality" reflects completed state
- [ ] `neutralino.config.json` has `"version": "1.0.0"`, correct `applicationName` and `binaryName`
