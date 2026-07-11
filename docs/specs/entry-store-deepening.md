# Spec: Entries Store Deepening Refactor

**Status**: `ready-for-agent`
**Date**: 2026-07-11
**Blocked by**: None
**Architecture review**: [docs/code-reviews/2026-07-11-architecture-review.md](../code-reviews/2026-07-11-architecture-review.md)
**GitHub issue**: [#1](https://github.com/AhmedOsman101/pass-gui/issues/1)

---

## Problem Statement

The entries Pinia store (`useEntriesStore`) has grown to 352 lines exporting 35 members across 6 unrelated concerns: tree state, form state, clipboard buffer, skeleton UX animation timers, sort mode, and CRUD orchestration. Every component that touches a password entry — AppSidebar, Tree, EntryDetail, EntryForm, plus 7 dialogs — imports the same monolithic seam and must understand the full interface to use any part of it.

This makes the codebase hard to navigate, hard to test, and creates coupling between concerns that should be independent (e.g., changing form behaviour should not require touching the same file that manages tree loading).

## Solution

Split the entries store into two focused Pinia stores and extract transient UI concerns into a composable and component-local logic. Each new module has a smaller interface and a single responsibility:

| Module | Responsibility | Interface size |
|---|---|---|
| `use-entry-tree-store` | Entry tree, current selection, sort mode, all CRUD operations | ~18 exports (was 35) |
| `use-entry-form-store` | Form mode, form path, form preset password | ~6 exports |
| `use-clipboard-buffer` | Copy/cut/paste buffer state | ~4 exports |
| Skeleton timer | In EntryDetail.vue via `watch(isLoadingEntry)` | None |
| searchQuery | In component layer (AppSidebar) with debounce | None |

Dead exports (`isLoadingEntry`, `formPath`, `cycleSortMode`, `generateEntry`) are removed.

## User Stories

1. As a developer, I want the entries store split into focused stores by concern, so that I can understand each module at a glance without reading 350 lines of mixed responsibilities.
2. As a developer, I want CRUD operations owned by the tree store, so that tree refresh after mutations stays local and callers don't need to orchestrate refresh themselves.
3. As a developer, I want form state (mode, path, preset password) extracted to a separate form store, so that the tree store does not own dialog-level UI state.
4. As a developer, I want the clipboard buffer (copy/cut/paste) extracted to a shared composable, so that the tree store does not manage transient clipboard operations.
5. As a developer, I want skeleton timer logic moved to EntryDetail.vue, so that animation timing lives in the component that renders the skeleton.
6. As a developer, I want search query state moved to the component layer with debounce, so that the store does not own an input field value.
7. As a developer, I want dead exports removed (isLoadingEntry, formPath, cycleSortMode, generateEntry), so that the interface surface is accurate and no misleading exports exist.
8. As a developer, I want search queries to expand matching directories and highlight matched results in the tree, so that the search UX is useful beyond simple filtering.

## Implementation Decisions

### Module layout

- **`stores/entry-tree.ts`** — Setup store (function form like existing stores). Exports: `use-entry-tree-store`. Owns:
  - State: `tree`, `currentPath`, `currentEntry`, `isLoadingTree`, `error`, `sortMode`, `hasEntries`
  - Actions: `loadTree`, `selectEntry`, `setCurrentPath`, `clearSelection`, `refresh`
  - CRUD actions: `insertEntry`, `removeEntry`, `moveEntry`, `duplicateEntry`, `editEntry`, `createFolder`
  - Sort actions: `setSortMode`
  - Each CRUD action calls `refresh()` after success and calls `selectEntry()` for non-directory mutations. Same behaviour as today.

- **`stores/entry-form.ts`** — Setup store. Exports: `use-entry-form-store`. Owns:
  - State: `formMode` ("create" | "edit" | null), `formPath`, `formPresetPassword`
  - Computed: `isFormOpen`
  - Actions: `openCreateForm(presetPassword?)`, `openEditForm(path)`, `closeForm()`

- **`composables/use-clipboard-buffer.ts`** — Composition function returning reactive state. Exports: `useClipboardBuffer`. Owns:
  - State: `copyBuffer` (path, mode "copy"|"cut", nodeType), exposed as readonly
  - Actions: `copyEntry(path, nodeType?)`, `cutEntry(path, nodeType?)`, `pasteEntry()`
  - `pasteEntry` calls the tree store's `moveEntry()` or `duplicateEntry()` depending on buffer mode, then clears the buffer.

### Component changes

- **AppSidebar.vue**: Owns `searchQuery` ref with debounce (300ms via `@vueuse/core` `useDebounceFn`). Passes query to Tree. Updates imports to point to the new stores and composable.
- **Tree.vue**: Receives `searchQuery` from AppSidebar or via the tree store. Uses `use-tree-state` composable. Expands matching directories when search is active. Applies CSS highlight class to matched node names.
- **EntryDetail.vue**: Owns skeleton timer via `watch(() => treeStore.isLoadingEntry, ...)` with 500ms delay. Fires toast on clipboard copy success (removes toast concern from clipboard store).
- **EntryForm.vue**: Imports `use-entry-form-store` for form state and `use-entry-tree-store` for CRUD actions.
- **All dialog components**: Update imports — `useEntriesStore` becomes `use-entry-tree-store` for CRUD calls.

### Removal of dead exports

- `isLoadingEntry` — remove from tree store. Components use `isLoadingTree` + local timer logic.
- `formPath` — remove. EntryForm reads `currentEntry.path` instead.
- `cycleSortMode` — remove. Only `setSortMode` is wired to the dropdown menu.
- `generateEntry` — remove. Components generate passwords locally and call `insertEntry`.

### Search behaviour

- Search query is debounced at 300ms.
- When search is active, the tree expands all directories containing matching entries.
- Matching node names are highlighted with a CSS class (e.g., `bg-accent/50 rounded`).
- When search is cleared, tree returns to previous expand/collapse state.

## Out of Scope

- New UI features (the refactor preserves existing behaviour)
- Adding tests (deferred to a separate session)
- Renaming existing components
- Candidate 2 (dialog unification) from the architecture review — separate work
- Candidate 3 (password generator consolidation) — separate work
- Candidate 5 (lib layer reversal) — not a real friction point after analysis

## Further Notes

- All stores use Pinia setup function syntax like existing stores in the project.
- Composable file naming follows React-like convention: kebab-case (`use-clipboard-buffer.ts`).
- The `use` prefix is preserved for composables and stores (Vue convention).
- If making changes to `composables/use-tree-state.ts`, update imports to point to the new `use-entry-tree-store` from `@/stores/entry-tree`.
- The clipboard store (`stores/clipboard.ts`) already handles system clipboard (readText/writeText/clear with timer). The new composable handles the in-memory copy/cut buffer used for tree operations — these are different concerns and should remain separate.
