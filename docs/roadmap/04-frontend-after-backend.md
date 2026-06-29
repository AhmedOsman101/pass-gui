# 04 Frontend After Backend

## Purpose

Build the UI only after the backend contracts are trustworthy.

## Goal

Create a frontend that reflects backend state cleanly instead of inventing its
own interpretation of readiness, stores, or entry operations.

## Required Outputs

### 1. Readiness-Driven App Entry

The first frontend job is not the password list. It is showing the correct app
state based on readiness.

That includes screens or flows for:

- ready,
- blocked by missing dependency,
- blocked by missing GPG state,
- blocked by invalid store,
- actionable recovery guidance.

### 2. State Layer Implementation

Implement the real Pinia stores only after the contracts are defined.

At minimum, the frontend should gain stores for:

- readiness,
- active store / store context,
- entries list,
- selected entry,
- clipboard feedback.

### 3. Core User Flows

Build the first UI flows in this order:

1. readiness and recovery messaging
2. store-aware entry listing
3. entry detail view
4. copy-to-clipboard flow
5. insertion/removal flows
6. search and filtering

### 4. Settings And Configuration UI

Only after the main flows work should the app expose configuration editing in
the interface.

That UI should sit on top of the validated config model already implemented.

## Design Direction

- prefer clear state transitions over clever component behavior
- show actionable errors, not raw command failures
- keep UI thin when backend logic already exists
- avoid building broad component libraries before the app flows exist

## What This Phase Depends On

Do not start this phase in earnest until:

- readiness is complete,
- entry operations are stable,
- state contracts are explicit,
- clipboard behavior is implemented in the backend/service layer.

## Exit Criteria For This File

Move on only when the app can support an end-to-end user journey:

- open app,
- understand readiness,
- view store entries,
- inspect an entry,
- copy a value,
- perform core mutations.

## Minimal Shape Example

```text
view -> store -> service -> result -> UI state
```
