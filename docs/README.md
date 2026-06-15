# pass-gui Documentation

## Directory Structure

```
docs/
├── README.md            <- this file
├── archive/             <- completed or historical documents
├── roadmap/             <- strategic direction (read first, in order)
├── specs/               <- atomic specifications per phase
├── plans/               <- execution plans per phase
└── references/          <- external reference material
```

## How To Use These Docs

### 1. Start with the roadmap

Read the roadmap files in order under `docs/roadmap/`. Each one defines
what outputs must exist before moving to the next phase.

### 2. Read the spec for your phase

Each roadmap phase has a matching spec under `docs/specs/` that defines
scope, required outcomes, and acceptance criteria. The spec is the
"what" — it does not change during implementation.

### 3. Follow the plan for your phase

Each phase has an execution plan under `docs/plans/` that specifies
the "how" — file changes, implementation order, and verification steps.

### Phase <-> Spec <-> Plan Mapping

| Roadmap Phase                 | Spec                         | Plan                               | Status                |
| ----------------------------- | ---------------------------- | ---------------------------------- | --------------------- |
| 01. Current State & Direction | — (strategic only)           | —                                  | ✅ Agreed             |
| 02. Backend Readiness         | `specs/backend-readiness.md` | `plans/backend-readiness-phase.md` | 📋 Ready to implement |
| 03. Entry Operations          | `specs/entry-operations.md`  | `plans/entry-operations-phase.md`  | 📋 Planned            |
| 04. Frontend UI               | `specs/frontend-ui.md`       | `plans/frontend-ui-phase.md`       | 📋 Planned            |
| 05. Release                   | `specs/release.md`           | `plans/release-phase.md`           | 📋 Planned            |

## Convention Rules

- **Roadmap**: Strategic "what" and "why". Changes rarely.
- **Specs**: Atomic, stable, implementation-free. Defines scope and acceptance.
- **Plans**: Concrete, file-level, ordered steps. Gets updated during execution.
- **Archive**: Completed or superseded docs go here. Never deleted.
