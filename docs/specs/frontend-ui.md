# Spec: Frontend UI

**Phase**: Roadmap phase 04
**Depends on**: Backend readiness (phase 02), entry operations (phase 03)

## Purpose

Build the user interface that consumes the backend contracts from phases 02 and
03. Every screen reflects backend state rather than inventing its own.

## Required Outcomes

### 1. Readiness-Driven App Entry

The app must not assume it enters at a password list. It shows the correct
screen based on the readiness state:

| Readiness State | UI Behavior |
|----------------|-------------|
| `DEPENDENCIES_MISSING` | Show blocked screen: which dependency is missing, how to install |
| `GPG_NOT_INITIALIZED` | Show blocked screen: no GPG keys found, how to generate them |
| `STORE_NOT_FOUND` | Show blocked screen: store path does not exist, offer creation flow |
| `STORE_INVALID` | Show blocked screen: .gpg-id issues, recipient mismatch, etc. |
| `READY` | Show password list |

Blocked screens must include actionable recovery guidance, not just error
messages.

### 2. State Layer (Pinia Stores)

Implement the stores that bridge backend contracts and UI components:

- **ReadinessStore**: Consumes readiness snapshot, exposes `isReady`,
  `blockingState`, `issues`, `checkReadiness()`.
- **StoreContextStore**: Active store path, GNUPGHOME, refresh triggers.
- **EntriesStore**: Entry tree, current filter, loading state, `list()`,
  `refresh()`, search/filter semantics.
- **SelectedEntryStore**: Currently viewed entry detail, loading state.
- **ClipboardStore**: Last clipboard action, timer status, `copy()`, `clear()`.

Stores must not reimplement backend logic. They call services and cache
results.

### 3. Core User Flows

Build in this order:

1. Readiness screen flow (blocked → ready transition)
2. Store-aware entry list (tree sidebar or folder view)
3. Entry detail panel (password display, metadata, copy button)
4. Clipboard UX (visual feedback, timer indicator)
5. Entry creation forms (insert + generate)
6. Entry removal with confirmation
7. Search/filter across entries

### 4. Settings UI

Only after the main flows work:

- Config section editing backed by ConfigService.
- Store selector (active store switching).
- Clipboard timeout, character generation preferences.
- Read-only display of validated config values.

### 5. App Shell

- Sidebar with entry tree (using existing shadcn-vue Sidebar components).
- Top bar with search, settings access, mode toggle.
- Main content area switching between password list, detail, and blocked states.
- Keyboard shortcuts for common actions.

## Design Direction

- Clear state transitions over clever component behavior.
- Actionable errors, not raw command failures.
- Thin UI — no business logic in components.
- Leverage existing shadcn-vue components; do not build new ones until needed.
- Dark/light mode support (already implemented).

## What This Depends On

Do not start this phase until:

- Backend readiness (phase 02) is complete.
- Entry operations (phase 03) are complete and stable.
- State contracts from phase 03 are explicit.
- Clipboard behavior is implemented in the backend layer.

## Error Handling

- UI components render error states from store data, not from caught exceptions.
- Actions display snackbar/toast for transient results.
- Blocked states persist until re-check shows readiness.

## Explicitly Out of Scope

- Multi-store management beyond active store switching
- Password generation UX enhancements (strength meter, history)
- Bulk operations
- Git history viewer
- OTP or extension support
- Release packaging
- Automated testing infrastructure

## Acceptance Criteria

- App opens to correct screen based on readiness (blocked or ready).
- Password list shows entries from the active store with folder structure.
- Clicking an entry shows its detail with password and metadata.
- Copy button writes to clipboard and shows timer.
- Entries can be created, generated, and removed from the UI.
- Search filters the entry list in real time.
- Settings UI displays and saves config changes.
- Dark/light mode works throughout.
