## Parent

Part of #21

## What to build

Own route for onboarding, gate redirects when blocked and allowlists that route, plus a pure step-machine that maps `(ReadinessSnapshot, config status)` to ordered steps with skip rules, rendered by a stepper shell.

## Acceptance criteria

- [ ] Non-READY readiness redirects to `/onboarding`; READY does not
- [ ] `/onboarding` renders outside the gate's blocking check (allowlist)
- [ ] Step machine is a pure function: given snapshot + config status returns steps, completed steps auto-skip
- [ ] Stepper shell shows current step and progress
- [ ] `mask typecheck` passes

## Blocked by

- #01
