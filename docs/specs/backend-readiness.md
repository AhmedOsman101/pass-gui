# Spec: backend-readiness

Scope: repo

# Backend Readiness Spec

## Purpose

Define the backend readiness gate that determines whether pass-gui can safely operate before entry operations or frontend flows begin.

## Scope

This phase validates only the configured active store from `core.active_store`.

It does not validate all configured stores, implement entry CRUD flows, or add frontend UI.

## Required Outcomes

- Produce a deterministic readiness result for the active store only.
- Return machine-usable and user-displayable readiness issues.
- Reuse existing config validation and backend service boundaries.
- Define a stable contract that a future Pinia readiness store can consume.

## Validation Order

1. Validate `pass` availability and supported version.
2. Validate GPG availability.
3. Require at least one usable secret key.
4. Load config and resolve `core.active_store`.
5. Resolve the active store definition, path, and effective `gnupg_home`.
6. Validate store structure:
   - path exists
   - path is a directory
   - `.gpg-id` exists
   - `.gpg-id` is not empty
7. Parse recipients from `.gpg-id`.
8. Verify recipients against the effective GPG keyring.
9. Run a safe behavioral validation using `pass ls` in the resolved environment.
10. Return a readiness snapshot.

## Readiness Model

The readiness layer must expose:

- a readiness state
- a list of structured issues
- validated metadata for pass, GPG, and the active store
- a timestamp or equivalent check marker suitable for future state consumption

Recommended state set:

- `DEPENDENCIES_MISSING`
- `GPG_NOT_INITIALIZED`
- `STORE_NOT_FOUND`
- `STORE_INVALID`
- `READY`

## Architectural Boundaries

- `PassService` remains focused on pass command execution and low-level helpers.
- `GpgService` remains focused on GPG command execution and low-level helpers.
- Store validation logic belongs in a dedicated validation/orchestration layer, not UI code.
- The readiness orchestrator is the single backend source of truth for startup readiness.
- Pinia stores must consume the readiness contract rather than inventing readiness behavior.

## Error Handling

All fallible operations must continue to use `Result<T, E>` and project error types.

Readiness issues/errors must support both:

- machine branching in backend orchestration
- direct display in future UI flows

## Explicitly Out of Scope

- validating every configured store
- multi-store management UX
- password listing/detail/mutation operations
- onboarding UI
- routing/UI integration beyond defining the future contract

## Acceptance Criteria

- Active-store readiness can distinguish dependency failures, GPG initialization failures, missing store failures, invalid store failures, and ready state.
- `.gpg-id` validation goes beyond existence and includes empty-file and recipient verification behavior.
- Effective `GNUPGHOME` handling respects configured active-store overrides where relevant.
- `pass ls` is used as the behavioral check for the resolved active store.
- The resulting readiness snapshot is suitable for future Pinia consumption.
- The phase leaves roadmap step `03` as the next boundary for entry operations.
