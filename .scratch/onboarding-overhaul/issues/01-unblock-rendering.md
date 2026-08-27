## Parent

Part of #21

## What to build

App renders the readiness gate even when GPG or `pass` init fails hard. Move module-level init promises in `main.ts` from mount-blocking awaits to lazy, failable init driven by the gate. Onboarding can then appear instead of a blank shell.

## Acceptance criteria

- [ ] With `pass` binary hidden from PATH, app shows the blocked/onboarding UI, not a blank screen
- [ ] With GPG misconfigured to a bad path, app still renders the gate
- [ ] Happy path (all binaries present) still reaches READY with no flash or regression
- [ ] `mask typecheck` passes

## Blocked by

None — can start immediately.
