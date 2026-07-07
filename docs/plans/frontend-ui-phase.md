# Frontend UI — Implementation Plan

> **Spec**: `docs/specs/frontend-ui.md`
> **Roadmap**: `docs/roadmap/04-frontend-after-backend.md`
> **Depends on**: Phase 02 (readiness) + Phase 03 (entry ops) completely implemented

## Goal

Build the user interface that consumes the backend contracts. The app renders the correct screen based on readiness state — blocked screens with actionable recovery guidance when deps are missing, or the password list when ready. Implements the app shell, entry tree, detail panel, clipboard UX, mutation dialogs, search, and (future) settings. Every screen reflects backend state rather than inventing its own.

## Prerequisites — All Done

- Readiness: 10-state granular model (`NEED_PASS`, `NEED_TREE`, `NEED_GPG`, `GPG_NO_KEYS`, `STORE_NOT_FOUND`, `STORE_NO_GPG_ID`, `STORE_GPG_ID_EMPTY`, `STORE_GPG_ID_KEY_MISSING`, `STORE_EMPTY`, `READY`) at `client/src/types/readiness.ts`
- `ReadinessService.check()` orchestrator at `client/src/services/readiness.ts`
- `ReadinessStore` at `client/src/stores/readiness.ts`
- Entry types: `EntryTree`, `EntryNode`, `EntryDetail`, `TreeIndex`, `VisibleNode` at `client/src/types/entries.ts`
- Entries service at `client/src/services/entries.ts` — all operations implemented
- Clipboard service at `client/src/services/clipboard.ts`
- shadcn-vue components: sidebar (full), button, input, separator, skeleton, tooltip, breadcrumb, sheet, collapsible, dropdown-menu, dialog, context-menu, resizable
- `ModeToggle.vue` exists at `client/src/components/`

## Current Architecture (2026-07)

### Pages

| Page           | Route       | Status                                                                         |
| -------------- | ----------- | ------------------------------------------------------------------------------ |
| `index.vue`    | `/` (auto)  | Main password management: resizable sidebar/detail layout                      |
| `blocked.vue`  | `/blocked`  | Not created as route; `BlockedScreen` component handles it via `ReadinessGate` |
| `settings.vue` | `/settings` | Future work                                                                    |

### App.vue

Thin shell — `ReadinessGate` wrapping `<RouterView>` + `<ClipboardToast>`. No sidebar layout here (that lives in `index.vue`).

### Pinia Stores

| Store              | File                     | Notes                                                                                                                                                           |
| ------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReadinessStore`   | `stores/readiness.ts`    | Readiness orchestration                                                                                                                                         |
| `EntriesStore`     | `stores/entries.ts`      | Entry tree, selection, search, clipboard buffer, form state, mutations. Richer than initial spec — includes copy/cut/paste buffer system, sort mode, form state |
| `ClipboardStore`   | `stores/clipboard.ts`    | Clipboard write + countdown timer (inlined, drift-corrected). No separate useClipboardTimer composable                                                          |
| `ActiveStoreStore` | `stores/active-store.ts` | Active store metadata (analogous to planned StoreContextStore)                                                                                                  |

### Key Components

| Component      | File                                     | Notes                                                                                                                                            |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AppSidebar     | `components/AppSidebar.vue`              | Full sidebar: sort dropdown, debounced search, New/Generate buttons, entry tree, context menus                                                   |
| Tree           | `components/Tree.vue`                    | Flat renderer with TransitionGroup animation, keyboard nav, per-node context menus, cut-dim/copy-pulse. Not recursive Collapsible                |
| EntryDetail    | `components/EntryDetail.vue`             | Detail panel with masked password, copy button, metadata, remove/edit                                                                            |
| ReadinessGate  | `components/readiness/ReadinessGate.vue` | Routes to loading/blocked/ready state                                                                                                            |
| BlockedScreen  | `components/readiness/BlockedScreen.vue` | Shows blocking issues                                                                                                                            |
| IssueCard      | `components/readiness/IssueCard.vue`     | Single issue display with recovery guidance                                                                                                      |
| ClipboardToast | `components/ClipboardToast.vue`          | Clipboard status indicator with countdown                                                                                                        |
| DirectoryTree  | `components/DirectoryTree.vue`           | Folder picker for dialogs (recursive expand/collapse)                                                                                            |
| Dialogs        | `components/`                            | InsertDialog, GenerateDialog, EditEntryDialog, RenameEntryDialog, DeleteConfirmDialog, MoveEntryDialog, DuplicateEntryDialog, CreateFolderDialog |

### Search

Inlined in `AppSidebar.vue`. Local ref debounced at 300ms via `@vueuse/core` `refDebounced`. No separate `SearchBar.vue` component.

### Router

Still uses `vue-router/auto-routes` (auto-routing from `pages/`). No explicit route definitions or navigation guard.

## Remaining Work

### Backend Polish

- [ ] Cache results in memory (entry tree)
- [ ] Watch filesystem for changes
- [ ] Timeout handling for command execution
- [ ] Handle GPG agent / passphrase prompts correctly
- [ ] Clear sensitive data from memory after use
- [ ] Structured error categories / developer debug mode

### Multiple Store Support

- [ ] Session-scoped `PASSWORD_STORE_DIR`
- [ ] Store switching within sessions
- [ ] Store creation flow (`pass init`)
- [ ] Per-store GNUPGHOME in UI

### Frontend

- [ ] Search: clear button, result count indicator
- [ ] Settings page: config editing (general, generation, clipboard, GPG info)
- [ ] Onboarding flows for missing pass/GPG/keys
- [ ] Empty state improvements

### Security

- [ ] Clear sensitive data from memory
- [ ] Avoid logging passwords accidentally

## Verification Checklist

- [x] shadcn-vue dialog component installed
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format` all pass
- [x] App opens to readiness check -> shows password list when ready
- [x] When deps are missing, shows blocked screen with actionable guidance
- [x] Password list shows entries from the active store with folder structure
- [x] Clicking a file selects it and shows detail panel on the right
- [x] Detail panel shows masked password, toggle reveals it
- [x] Copy button writes to clipboard and shows countdown indicator
- [x] Create dialog (insert/generate modes) creates entry visible in tree
- [x] Remove dialog requires confirmation before removing
- [x] Search filters the tree (debounced 300ms)
- [x] Dark/light mode toggle works
- [x] Sidebar collapses/expands correctly
- [x] Directory tree picker works for move/duplicate operations
- [x] Empty store shows "No entries yet" with create button
