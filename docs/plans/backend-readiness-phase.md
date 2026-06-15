# Backend Readiness Phase Plan

## Goal

Finish the backend hard-gate needed before frontend feature work by implementing dependency readiness, store validation, and a backend-facing readiness contract that a future Pinia store can consume.

## Roadmap Alignment

This plan is the implementation-oriented companion to:

- `roadmap/01-current-state-and-direction.md`
- `roadmap/02-backend-foundation-and-readiness.md`
- `roadmap/03-entry-and-operations-backend.md`

It exists to execute roadmap step `02` in concrete terms, while keeping the
later transition into roadmap step `03` explicit.

## Current Context

The repository is ahead of the old roadmap in some backend areas and behind it in readiness orchestration:

- `client/src/services/pass.ts` already validates `pass` existence/version and executes scoped `pass` commands.
- `client/src/services/gpg.ts` already resolves GPG, parses version/home, and lists secret keys.
- `client/src/services/config.ts` and related config validation are now in solid shape.
- There is no real readiness orchestrator yet.
- There is no meaningful app state store yet beyond `client/src/stores/counter.ts`.

This means the next phase should not jump to password listing UI or entry operations yet. The backend still needs a reliable readiness gate so the rest of the application can depend on known-good state.

## Roadmap Review

`docs/prompt.md` remains historical context only.

The current strategic source of truth is the numbered roadmap under
`roadmap/`. This plan should be read as the executable planning layer for the
backend readiness phase, not as a replacement for the roadmap.

## Recommended Next Phase

### Phase Name

Backend Readiness Gate

### Objective

Provide a single backend source of truth for whether the app is usable, why it is blocked when it is not usable, and what validated runtime inputs should be exposed to the rest of the application.

### Deliverables

- dependency validation for `pass` and `gpg`
- store validation beyond simple `.gpg-id` existence
- readiness result/error model for backend consumers
- future Pinia-facing store contract definition, without UI implementation
- startup orchestration service that produces deterministic readiness states

These deliverables map directly to the outputs described in
`roadmap/02-backend-foundation-and-readiness.md`.

## Scope

### In Scope

- validate `pass` availability and minimum version
- validate GPG availability and ensure at least one secret key exists
- respect configured and per-store `GNUPGHOME` where relevant
- validate the active store path and `.gpg-id`
- ensure `.gpg-id` is not empty
- parse store recipient IDs from `.gpg-id`
- verify recipients against the GPG keyring
- detect invalid or mismatched store recipients
- run a safe behavioral check with `pass ls`
- map outcomes into deterministic readiness states
- define a store contract for later Pinia integration

### Out of Scope

- actual frontend views or onboarding UI flows
- password listing UI
- entry operations (`show`, `insert`, `generate`, `rm`, etc.)
- clipboard UX
- full app routing integration

Those concerns belong to the later backend operations and frontend phases in
`roadmap/03-entry-and-operations-backend.md` and
`roadmap/04-frontend-after-backend.md`.

## Proposed Architecture

### 1. Readiness Domain Types

Create explicit backend-facing readiness types that separate:

- current status
- validated environment details
- actionable failure reasons

Recommended shape:

- `ReadinessState`
  - `DEPENDENCIES_MISSING`
  - `GPG_NOT_INITIALIZED`
  - `STORE_NOT_FOUND`
  - `STORE_INVALID`
  - `READY`
- `ReadinessIssue`
  - structured machine-readable issue code
  - user-displayable message
  - optional supporting metadata
- `ReadinessSnapshot`
  - final state
  - validated `pass` info
  - validated `gpg` info
  - validated active store info
  - issue list

This should live in `client/src/types/` so both backend services and a future store can share it.

### 2. Store Validation Model

Add a dedicated validation service rather than growing `PassService` into a god module.

Recommended split:

- `PassService`: command execution and pass-specific low-level helpers
- `GpgService`: gpg-specific low-level helpers
- new store validation service: `.gpg-id`, recipients, and behavioral checks
- new readiness service: orchestrates everything and returns a `ReadinessSnapshot`

This keeps boundaries clear:

- low-level command services stay reusable
- validation logic stays explicit and testable
- orchestration remains the single startup decision point

### 3. Future Pinia Store Contract

Even though frontend work is deferred, define a stable store-facing contract now.

Recommended contract shape:

- state
  - `snapshot: ReadinessSnapshot | null`
  - `loading: boolean`
  - `lastCheckedAt: string | null`
- actions
  - `checkReadiness()`
  - `refreshReadiness()`
- getters/derived semantics
  - `isReady`
  - `blockingState`
  - `issues`

Do not implement UI consumers in this phase. The point is to lock the boundary so later frontend work consumes the backend cleanly.

## Validation Pipeline

Run readiness in a fixed order so the first hard failure is deterministic and debugging is straightforward.

### Step 1: Validate `pass`

- ensure binary exists
- resolve actual path
- verify minimum supported version
- if missing or invalid, return `DEPENDENCIES_MISSING`

### Step 2: Validate GPG backend

- ensure `gpg` or `gpg2` exists
- resolve binary info
- parse version and home directory
- list secret keys
- require at least one secret key
- if no usable keyring, return `GPG_NOT_INITIALIZED`

### Step 3: Resolve active store configuration

- load config
- resolve `core.active_store`
- fetch store definition from `stores`
- normalize path and effective `GNUPGHOME`

If the configured active store is missing at runtime, map to `STORE_NOT_FOUND` or `STORE_INVALID` depending on the cause.

### Step 4: Structural store validation

- path exists
- path is directory
- `.gpg-id` exists
- `.gpg-id` is not empty

### Step 5: Cryptographic store validation

- parse recipient lines from `.gpg-id`
- ignore empty/comment lines if needed
- verify each recipient against the active GPG keyring
- distinguish:
  - empty recipient list
  - malformed file
  - unknown key ids
  - mismatched key material

### Step 6: Behavioral store validation

- run safe `pass ls` under the resolved store environment
- fail if command exits non-zero
- include command error details in machine-readable form

### Step 7: Produce readiness snapshot

- if all checks pass, return `READY`
- include validated binary/store metadata for downstream consumers

## File-Level Plan

### Likely new files

- `client/src/types/readiness.ts`
- `client/src/services/store-validation.ts`
- `client/src/services/app-readiness.ts`
- `client/src/stores/readiness.ts` or equivalent contract file if you want the store boundary captured now

### Likely modified files

- `client/src/services/pass.ts`
- `client/src/services/gpg.ts`
- `client/src/services/config.ts`
- `client/src/lib/errors.ts`
- `TODO.md` after completion

## Error Model Recommendations

The current project already uses custom error classes and `Result<T, E>`. Extend that pattern rather than introducing ad-hoc strings.

Add readiness-oriented error categories for:

- missing dependency
- unsupported version
- missing secret keys
- invalid store path
- invalid `.gpg-id`
- unknown recipient key
- behavioral `pass` command failure

Each should be suitable for both:

- machine branching in the readiness service
- direct user display later in onboarding UI

## Design Choices and Trade-offs

### Recommended Approach: dedicated readiness orchestrator

Why:

- keeps `pass.ts` and `gpg.ts` focused
- makes startup behavior deterministic
- creates a stable boundary for later UI work
- aligns with backend-first development

### Alternative: grow `PassService.init()` into the readiness orchestrator

Why not recommended:

- mixes command execution with high-level app startup policy
- makes store/GPG/config interactions harder to reason about
- will become harder to extend when onboarding and multi-store switching are added

### Alternative: implement the store first and let it orchestrate services

Why not recommended:

- pulls frontend state into a backend phase
- makes the store responsible for domain orchestration instead of consuming it

## Verification Plan

Because the current project has no real test framework configured and you are finishing backend first, the minimum implementation verification for this phase should be:

1. `pnpm typecheck`
2. `pnpm lint && pnpm format`
3. manual readiness checks covering:
   - missing `pass`
   - missing/empty GPG keyring
   - missing store path
   - empty `.gpg-id`
   - unknown recipient in `.gpg-id`
   - valid ready state

If you later choose to add tests, this phase would benefit most from fixture-based service tests for `.gpg-id` parsing and readiness state mapping.

## Suggested Execution Order

1. define readiness types and issue model
2. implement `.gpg-id` parsing and structural store validation
3. implement GPG recipient verification helpers
4. implement behavioral validation with `pass ls`
5. build the `app-readiness` orchestrator
6. define or add the future Pinia store contract without UI wiring
7. verify all target readiness scenarios manually and with static checks

## Recommendation

The next planned implementation phase should be:

**Backend Readiness Gate**

This is the cleanest next step because it finishes the backend foundation that all later frontend features depend on, while still giving you a stable store-facing contract for future UI work.

After this phase is complete, the next planning target should be the backend
operations phase in `roadmap/03-entry-and-operations-backend.md`.

## Related Specification

See `docs/specs/backend-readiness.md` for the formal spec this plan implements.