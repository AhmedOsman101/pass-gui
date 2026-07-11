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

> **Note**: If you rename any plan file in `docs/plans/`, update the corresponding link references in this table and in `AGENTS.md` to avoid broken links.

## Project Direction

- Backend first
- Stable service and state contracts before major UI work
- Config and store correctness before entry operations
- Security and explicit error handling as first-class requirements
- Lean documents here, detailed implementation plans in `docs/plans/`

## Doc Structure

Each roadmap phase has companion files in `docs/`:

| Phase                  | Spec (scope + acceptance)         | Plan (execution steps)                              | Status      |
| ---------------------- | --------------------------------- | --------------------------------------------------- | ----------- |
| 02 – Backend Readiness | `docs/specs/backend-readiness.md` | `docs/plans/2026-06-27-onboarding-state-machine.md` | ✅ Complete |
| 03 – Entry Operations  | `docs/specs/entry-operations.md`  | `docs/plans/2026-06-30-entry-operations.md`         | ✅ Complete |
| 04 – Frontend UI       | `docs/specs/frontend-ui.md`       | `docs/plans/2026-07-01-frontend-phase-04.md`        | ⏳ Partial  |
| 04b – Frontend UI      | —                                 | `docs/plans/2026-07-02-frontend-ui-remaining.md`    | ⏳ Partial  |
| 05 – Release           | `docs/specs/release.md`           | `docs/plans/release-phase.md`                       | ⏳ Waiting  |

> Superseded plans remain in `docs/plans/` as historical records:
> `backend-readiness-phase.md` and `entry-operations-phase.md` -- kept for architecture reference but not current execution sources. The `frontend-ui-phase.md` is a high-level summary; the dated plan is the actual step-by-step execution document.

## Notes

- Older roadmap files were replaced because they assumed a bootstrap or
  UI-first phase that no longer matches the codebase.
- `docs/plans/` remains the place for implementation-specific plans.
- `docs/specs/` holds stable scoping specs that do not change during execution.

---

Last updated: July 8, 2026
