# Spec: Release

**Phase**: Roadmap phase 05
**Depends on**: Backend readiness (02), entry operations (03), frontend UI (04)

## Purpose

Move from a working development build to a distributable desktop app with clear
documentation and a post-release maintenance baseline.

## Required Outcomes

### 1. Hardening And Verification

Before release, verify:

- Critical flows work against a real password store:
  - App startup with readiness detection
  - Entry listing, detail view, copy to clipboard
  - Entry creation, generation, removal
  - Config changes persist across app restarts
- Error states are understandable:
  - Missing pass binary shows actionable message
  - Missing GPG keys shows actionable message
  - Invalid store shows actionable message
  - Clipboard errors surface gracefully
- Clipboard clearing behaves as intended across all configured selections.
- Config creation on first launch works correctly.
- Config save round-trips preserve comments and formatting.
- Sensitive values are never logged or persisted in plain text.
- App does not block indefinitely on any service initialization failure.

### 2. Packaging

- Production build is verified: `pnpm build` completes without errors.
- NeutralinoJS packaging works for development platform.
- Binary is runnable outside the development environment.
- Release script or process is documented.
- Target-platform sanity checks (Linux primary, macOS/Windows secondary).

### 3. User Documentation

Create user-facing docs under `docs/wiki/`:

- System requirements (pass, GPG, platform notes).
- Installation and setup.
- Configuration file location and format reference.
- Store requirements (.gpg-id, recipients, GPG keyring).
- Common recovery steps for blocked readiness states.
- Keyboard shortcuts reference.

### 4. Maintenance Baseline

- `docs/roadmap/README.md` updated with post-release direction.
- `TODO.md` updated to reflect completed and remaining work.
- `docs/plans/` cleaned up to match the delivered phase structure.
- `AGENTS.md` updated with current project state.

## Hardening Checklist

- [ ] Clipboard timer works for all `clipboard.selection` modes
- [ ] Config round-trip preserves comments
- [ ] No plaintext passwords in logs, errors, or state
- [ ] App does not block on init failure (graceful readiness screen)
- [ ] Blocked states show actionable guidance
- [ ] Search works across the full entry tree
- [ ] Entry creation validates path safety
- [ ] Removal confirms before executing
- [ ] App shell adapts to window resize

## Acceptance Criteria

- The app can be built, packaged, and run on the target platform.
- A new user can set up the app with only the user docs.
- One full end-to-end user journey works:
  open → readiness check → view entries → inspect an entry →
  copy a value → create an entry → remove an entry → quit.
- `pnpm build` produces a valid distributable binary.
- The project is ready for public or personal use.

## Future Work (Post-Release)

These are explicitly deferred to keep the first release focused:

- Richer multi-store management
- Password generation UX improvements (strength meter, history)
- Rename/move/copy entry workflows
- Git-aware store history features
- OTP and pass-extension support
- Automated test suite
- CI/CD pipeline
- Flatpak/AppImage/Snap packaging
- Windows/macOS native installers
