# Spec: Entry Operations

**Phase**: Roadmap phase 03
**Depends on**: Backend readiness (phase 02) complete

## Purpose

Build the backend password-management operations that the frontend will consume:
entry listing, detail retrieval, mutations, and clipboard behavior.

## Scope

This phase builds the complete backend for working with password entries in the
active store. It produces stable service contracts and domain types. It does
not build UI screens.

## Required Outcomes

### 1. Entry Listing

- Parse `pass ls` output into a deterministic tree structure (folders + leaves).
- Handle empty stores gracefully (return empty tree, not error).
- Handle deeply nested folder structures.
- Return entries in normalized form (consistent separators, no trailing slashes).
- Support refresh — re-run `pass ls` and produce a fresh tree.
- Do not traverse the filesystem manually.

### 2. Entry Detail Retrieval

- Parse `pass show <path>` output into a stable domain model.
- Separate the first line (password/secret) from remaining metadata lines.
- Support known metadata fields (username, URL, email, notes, etc.) as
  key-value pairs without enforcing a fixed schema.
- Preserve the raw path identity for round-trip operations.
- Return clear errors for nonexistent paths or store-access failures.

### 3. Entry Mutations

- Support `pass insert <path>` for adding new entries.
- Support `pass generate <path>` for password generation (respecting config).
- Support `pass rm <path>` for safe removal with confirmation option.
- Support `pass mv <old> <new>` for rename/move.
- Support `pass edit <path>` for in-place editing.
- All mutations return clear success/failure results.
- Mutations must use scoped environment (`PASSWORD_STORE_DIR`).

### 4. Clipboard Behavior

- Write entry secret to system clipboard via NeutralinoJS clipboard API.
- Clear clipboard after configured delay (`clipboard.clear_after_seconds`).
- Respect `clipboard.selection` config (clipboard / primary / secondary).
- Provide a clear result indicating success, timer status, and which selection
  was used.
- Support manual abort of pending clipboard timer.

### 5. State Contracts

Define stable TypeScript contracts (types only, no UI) for:

- Entry tree (folders and leaves)
- Entry detail (secret, metadata, path)
- Mutation result (success vs. error, changed path, old path for renames)
- Clipboard action (target path, timer duration, selection)
- Loading, error, and empty states for each operation

## Architectural Boundaries

- Entry parsing belongs in dedicated parser functions, not in services.
- Services handle command execution only.
- The clipboard service consumes config but does not own timer logic.
- Timer logic belongs in a composable or dedicated clipboard manager.
- Pinia stores consume these contracts; they do not invent them.

## Error Handling

All operations must use `Result<T, E>` with project error types.

New error categories needed:
- EntryNotFoundError (path does not exist in store)
- EntryAlreadyExistsError (insert/generate on existing path)
- EntryParseError (unexpected pass output format)
- ClipboardError (OS-level clipboard failure)
- MutationError (pass command failed, with exit code and stderr)

## Explicitly Out of Scope

- Polished screens or UI flows
- Search/filter functionality
- Multi-store management
- Password generation UX (password strength meter, etc.)
- Bulk operations
- Git history or OTP extensions
- Release packaging

## Acceptance Criteria

- Entries can be listed from the active store with folder structure preserved.
- Entry details can be retrieved with password and metadata separated.
- Entries can be inserted, generated, removed, and renamed safely.
- Clipboard copies password and clears after configured delay.
- All operations return typed results suitable for Pinia consumption.
- The phase leaves roadmap phase 04 as the next boundary.
