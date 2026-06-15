# Release Phase — Implementation Plan

> **Spec**: `docs/specs/release.md`
> **Roadmap**: `docs/roadmap/05-release-and-future-work.md`
> **Depends on**: Phase 02 (readiness), Phase 03 (entry ops), Phase 04 (frontend UI)
> **Status**: Depends on all prior phases being complete and verified

**Goal**: Harden, package, and document the app for distribution. Establish a
post-release maintenance baseline.

**Architecture**: This is a hardening and process phase. No new features. No
new services. Work is verification, documentation, packaging, and cleanup.

**Tech Stack**: NeutralinoJS packaging, Markdown docs, shell scripts

---

## Files Affected

| File                               | Change                                                |
| ---------------------------------- | ----------------------------------------------------- |
| `neutralino.config.json`           | Verify release config, update app version             |
| `docs/wiki/` (new dir)             | User documentation                                    |
| `docs/wiki/system-requirements.md` | Pass/GPG/platform requirements                        |
| `docs/wiki/installation.md`        | Install and setup guide                               |
| `docs/wiki/configuration.md`       | Config file reference (or link existing)              |
| `docs/wiki/troubleshooting.md`     | Common recovery steps                                 |
| `docs/wiki/keyboard-shortcuts.md`  | Shortcut reference                                    |
| `docs/roadmap/README.md`           | Add post-release direction note                       |
| `TODO.md`                          | Mark release items, consolidate completed work        |
| `AGENTS.md`                        | Verify current-state section is accurate              |
| `docs/README.md`                   | Verify phase mapping is correct                       |
| (release script)                   | `scripts/release.sh` or `package.json` release target |

---

## Implementation Order

### Sub-phase 5.1: Hardening Verification

Systematic check of every critical path.

**Checklist to verify:**

1. **Readiness flows**
   - Remove `pass` binary from PATH temporarily -> app shows DEPENDENCIES_MISSING
   - Remove GPG keyring -> app shows GPG_NOT_INITIALIZED
   - Remove `.gpg-id` -> app shows STORE_INVALID
   - Valid setup -> app shows READY and loads password list
   - Each blocked state shows actionable text

2. **Entry operations**
   - List entries from a real store with 20+ entries across folders
   - Show detail for a multi-line entry (password + metadata)
   - Copy to clipboard -> verify content matches -> wait for clear -> verify cleared
   - Create a new entry -> verify it appears in listing
   - Generate a password -> verify it appears in store filesystem
   - Remove an entry -> verify it disappears from listing

3. **Config persistence**
   - Delete existing config -> app regenerates it with comments
   - Modify a config value -> save -> reopen config -> value persists
   - Modify store path -> app shows correct new state

4. **Security**
   - Search logs for any plaintext password output
   - Verify clipboard clears after configured delay
   - Verify clipboard clears on app quit
   - Verify no password data in Vue devtools state (pinia state masking)

### Sub-phase 5.2: Fix Init Promise Architecture

Address the known architectural issue where module-level init promises block
app mount.

**Problem**: `neuInitialized`, `gpgInitialized`, `passInitialized` in `main.ts`
are awaited with `Promise.all()`. If one fails, the app never renders.

**Fix**: Replace the block pattern with the readiness orchestrator:

1. Remove `Promise.all([neuInitialized, gpgInitialized, passInitialized])`
   from `main.ts`.
2. Ensure `neu` initialization completes before anything else (NeutralinoJS
   must be ready to call any native API).
3. Let GPG and pass initialization happen as part of the readiness check, not
   as a hard gate before `createApp()`.
4. `createApp().mount()` runs immediately. The first route renders a loading
   state that transitions to blocked or ready based on readiness check result.

**`client/src/main.ts` changes:**

- Only `await neuInitialized` here (or restructure to use Neutralino ready
  callback instead of a module-level promise).
- Remove gpg/pass init promises from main.ts.
- Move their initialization into the readiness orchestrator.

**`client/src/services/neutralino.ts` changes:**

- Keep `init()` but ensure it only resolves once.
- No longer export `gpgInitialized`/`passInitialized` -style promises from
  neutralino.ts. These belong in their respective service modules, and only
  the readiness orchestrator awaits them.

### Sub-phase 5.3: Build Packaging

Prepare a repeatable build path.

**Verify:**

- `pnpm build` completes without errors
- `pnpm build:frontend` completes without errors
- The built binary is runnable from a clean environment

**Create or update:**

- Add `pnpm release` target in `package.json` if not already correct
- Verify `neutralino.config.json` has correct:
  - `appVersion` (semver)
  - `appName` ("pass-gui" or similar)
  - `cli.binaryName`
  - `neu CLI version` matches workspace dev dependency

**Document:**

- Build requirements (Neutralino CLI, pnpm, node version)
- Build steps in README or wiki
- How to create a distributable binary

### Sub-phase 5.4: User Documentation

Create `docs/wiki/` with user-facing docs.

**`docs/wiki/system-requirements.md`**

- Required: `pass` (>= 1.7.0), `gpg`/`gpg2`, GPG key pair
- Platform notes: Linux (primary), macOS, Windows
- Optional: custom GNUPGHOME, extensions

**`docs/wiki/installation.md`**

- Download binary (or build from source)
- First-launch config generation
- Store setup: `pass init` if no store exists

**`docs/wiki/configuration.md`**

- Config file location per platform
- All sections and keys with descriptions
- Default values
- Cross-field validation rules (active_store must reference defined store)

**`docs/wiki/troubleshooting.md`**

- "pass not found" -> how to install pass
- "No GPG keys" -> how to generate a key pair
- "Store not found" -> how to create/init a store
- "Invalid .gpg-id" -> how to fix recipient mismatch
- "Clipboard not working" -> platform-specific clipboard issues

**`docs/wiki/keyboard-shortcuts.md`**

- Document implemented shortcuts as they exist

### Sub-phase 5.5: Docs Cleanup

**`TODO.md`**

- Mark all verified-complete items with `[x]`
- Add a "Future" section for deferred items
- Remove or consolidate redundant items

**`docs/roadmap/README.md`**

- Update status: all 5 phases complete
- Add post-release section: "The app is at MVP. Future work listed in
  roadmap/05-release-and-future-work.md under Future Work."

**`docs/README.md`**

- Verify phase mapping is complete
- Update status from "Planned" to "Done" for all phases

---

## Verification

```bash
pnpm typecheck                              # Must pass
pnpm lint && pnpm format                    # Must pass
pnpm build                                  # Must produce valid binary
```

Full end-to-end test:

1. Delete config -> launch app -> config regenerates correctly
2. App detects pass/GPG/store -> shows ready state
3. List entries -> view detail -> copy password -> verify clipboard
4. Wait for clipboard clear -> verify clipboard is empty
5. Create entry -> verify in listing
6. Remove entry -> verify removed from listing
7. Change config in settings -> restart -> changes persist
8. Verify no plaintext passwords in logs, errors, or state

---

## Risks And Watchouts

- **NeutralinoJS init architecture**: The blocking init promises fix is
  potentially disruptive. Test thoroughly. If it breaks the NeutralinoJS
  initialization sequence, app may lose native API access entirely.
- **Release binary**: NeutralinoJS packaging produces binaries for the current
  platform only. Cross-platform packaging requires additional tooling.
- **Clipboard clearing on quit**: NeutralinoJS may not have a reliable quit
  hook. Document if this is not implemented.
- **Documentation drift**: User docs must match the actual app behavior. Have
  someone unfamiliar with the project follow the installation guide.

---

## Progress Tracking

Update `TODO.md` sections:

- Section 9 (Security Hardening) — mark all verified items
- Section 13 (Documentation) — add wiki items, mark done
- Add "Completed" header above all verified items
- Move deferred items to a "Future" section at the bottom
