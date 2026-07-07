# 02 Backend Foundation And Readiness

> **Status**: ✅ Complete — 10-state readiness model, StoreValidationService, ReadinessService orchestrator, ReadinessStore all implemented and in production.

## Purpose

Finish the backend layer that determines whether the app can safely operate
before any password-management UI is built.

## Goal

Produce one reliable readiness snapshot that future stores and views can use
as their source of truth.

## Why This Comes Next

The repo already has:

- config validation,
- default config generation,
- service wrappers for external commands,
- early store-path handling.

What it does not yet have is a single answer to: "Can this app operate right
now, and if not, why not?"

## Required Outputs

### 1. Dependency Validation

The backend should verify:

- `pass` exists,
- `pass` version is acceptable,
- `gpg` or `gpg2` exists,
- at least one usable secret key is available.

### 2. Active Store Resolution

The backend should resolve the configured active store and the effective paths
it depends on.

This includes:

- store path,
- optional per-store `GNUPGHOME`,
- the `.gpg-id` file for the store.

### 3. Store Validation

Validation should go beyond "file exists".

It should cover:

- store path exists,
- `.gpg-id` exists,
- `.gpg-id` is not empty,
- recipient IDs can be parsed,
- recipients map to real keys,
- `pass ls` behaves correctly for that store.

### 4. Readiness Domain Model

Define a small, explicit model for readiness state and issues.

The shape should support results like:

- dependency missing,
- GPG not initialized,
- store not found,
- store invalid,
- ready.

Keep the model simple enough that a future store or view can consume it
without reinterpretation.

### 5. Store Contract For Future State Layer

Even without implementing full UI state yet, define the contract the future
Pinia readiness store will expose.

At minimum, it should be able to provide:

- current readiness snapshot,
- whether a check is in progress,
- issues blocking progress,
- an action to re-run readiness checks.

## Recommended Flow

The readiness pipeline should run in this order:

1. validate `pass`
2. validate GPG backend and keys
3. resolve active store
4. validate store structure
5. validate store recipients
6. run safe behavioral check
7. produce readiness snapshot

## Architectural Direction

Prefer small services with clear boundaries.

- one service for store validation,
- one orchestration service for readiness,
- explicit readiness types,
- error types that can be shown directly in the UI later.

Avoid mixing readiness orchestration into page code or generic utility files.

## Out Of Scope For This Phase

- full password listing UI
- entry details views
- insertion and deletion flows
- broad component work
- visual onboarding flows

## Exit Criteria For This File

Move on only when the backend can answer, with deterministic output:

- Is `pass` usable?
- Is GPG usable?
- Is the active store valid?
- Why is the app blocked?
- What should future state/UI consume as the readiness source of truth?

## Minimal Shape Example

```text
checkReadiness() -> snapshot { state, issues, activeStore, checkedAt }
```
