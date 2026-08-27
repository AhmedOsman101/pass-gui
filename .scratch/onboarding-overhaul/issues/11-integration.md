## Parent

Part of #21

## What to build

Integration and polish: Settings Run setup again entry, handoff to main app on completion (empty store handled by existing empty state), satisfied steps auto-skip verified across the full walkthrough. Cold-start path (no config, no keys, no store) to Ready end-to-end.

## Acceptance criteria

- [ ] Settings has Run setup again linking to `/onboarding`
- [ ] Completed onboarding navigates to main app with no ceremony
- [ ] Full cold-start walkthrough passes: binaries, config, keys, store to Ready
- [ ] Auto-skip of already-satisfied steps verified
- [ ] `mask typecheck` passes

## Blocked by

- #03, #06, #07, #09, #10
