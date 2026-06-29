# GNU Pass GUI Roadmap

This directory is the current strategic roadmap for the project.

Read the files in order. Each one defines the outputs that should exist
before moving to the next file.

## Read Order

1. [01-current-state-and-direction.md](./01-current-state-and-direction.md)
2. [02-backend-foundation-and-readiness.md](./02-backend-foundation-and-readiness.md)
3. [03-entry-and-operations-backend.md](./03-entry-and-operations-backend.md)
4. [04-frontend-after-backend.md](./04-frontend-after-backend.md)
5. [05-release-and-future-work.md](./05-release-and-future-work.md)

## How To Use This Roadmap

- `01` explains the current reality of the repo and the guiding rules.
- `02` finishes the backend foundation and readiness gate.
- `03` builds the real password-management backend on top of that.
- `04` starts frontend work only after backend contracts are stable.
- `05` handles release polish and what comes after the first usable app.

## Project Direction

- Backend first
- Stable service and state contracts before major UI work
- Config and store correctness before entry operations
- Security and explicit error handling as first-class requirements
- Lean documents here, detailed implementation plans in `docs/plans/`

## Doc Structure

Each roadmap phase has two companion files in `docs/`:

| Phase                  | Spec (scope + acceptance)         | Plan (execution steps)                  |
| ---------------------- | --------------------------------- | --------------------------------------- |
| 02 – Backend Readiness | `docs/specs/backend-readiness.md` | `docs/plans/backend-readiness-phase.md` |
| 03 – Entry Operations  | `docs/specs/entry-operations.md`  | `docs/plans/entry-operations-phase.md`  |
| 04 – Frontend UI       | `docs/specs/frontend-ui.md`       | `docs/plans/frontend-ui-phase.md`       |
| 05 – Release           | `docs/specs/release.md`           | `docs/plans/release-phase.md`           |

## Notes

- Older roadmap files were replaced because they assumed a bootstrap or
  UI-first phase that no longer matches the codebase.
- `docs/archive/prompt.md` is historical context, not the execution source of truth.
- `docs/plans/` remains the place for implementation-specific plans.
- `docs/specs/` holds stable scoping specs that do not change during execution.

---

Last updated: June 15, 2026
