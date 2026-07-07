# 03 Entry And Operations Backend

> **Status**: ✅ Complete — EntriesService, ClipboardService, walkStore, parsePassShowOutput, all entry domain types implemented and in production.

## Purpose

Build the real password-management backend only after readiness is complete.

## Goal

Expose stable backend operations for working with password entries and prepare
the contracts that the frontend will later consume.

## Required Outputs

### 1. Entry Listing

Support reliable password-store traversal for the active store.

This layer should define:

- how entries are listed,
- how folders and leaves are represented,
- how names and paths are normalized,
- how refresh works after mutations.

### 2. Entry Detail Retrieval

Support `pass show` parsing into a stable domain model.

The domain model should separate:

- secret value,
- known metadata fields,
- additional arbitrary fields,
- raw path identity.

### 3. Entry Mutations

Support the first real write operations:

- insert entry,
- remove entry,
- later update or rename if needed.

The goal here is safe behavior and clear errors, not broad feature coverage.

### 4. Clipboard Behavior Backed By Real Services

Clipboard behavior should be driven by app logic and config, not guessed UI
timers.

This should cover:

- write to clipboard,
- clear after configured delay,
- clear on relevant lifecycle boundaries if needed.

### 5. Stable State Contracts

Before major UI work, define the state contracts that frontend stores will use.

Examples:

- entries list contract,
- selected entry contract,
- mutation/loading/error states,
- refresh contract after mutations,
- clipboard action contract.

## Architectural Direction

Keep a clean separation between:

- command execution,
- pass parsing,
- domain models,
- orchestration/state-facing services.

Do not let components or ad hoc store code become the place where pass output
is interpreted.

## Recommended Sequencing Inside This Phase

1. finalize entry domain types
2. implement listing pipeline
3. implement detail retrieval and parsing
4. implement first mutation flows
5. wire clipboard behavior to config-backed service logic
6. define state-facing contracts for future Pinia stores

## Out Of Scope For This Phase

- polished screens
- search UX details
- major dialog systems
- settings UI
- release packaging

## Exit Criteria For This File

Move on only when the backend can support:

- listing entries from the active store,
- showing entry details,
- performing core mutations safely,
- clipboard operations with configured timing,
- a stable contract layer that a frontend can consume without redefining logic.

## Minimal Shape Example

```text
entries service -> list(), show(path), insert(input), remove(path)
```
