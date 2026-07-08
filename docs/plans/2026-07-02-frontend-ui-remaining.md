# Frontend UI Remaining - Quest Chain

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

## Progress

- [x] Quest 1: The App Shell — DONE (sidebar layout in `pages/index.vue`)
- [x] Quest 2: The Passwords Page — DONE (two-panel AppSidebar + EntryDetail in `pages/index.vue`)
- [ ] Quest 3: The Settings Page
- [ ] Quest 4: The Clean Sweep

**Goal:** Complete the remaining frontend work - settings page and cleanup of old artifacts.

## Prerequisites

- Phase 04 stores all exist: readiness, entries, clipboard, active-store
- Components exist: Tree (flat renderer), EntryDetail, AppSidebar, dialogs, BlockedScreen, IssueCard, ClipboardToast, PasteToast
- `@vueuse/core` available for debounce (already used)
- App shell + passwords page already functional in `pages/index.vue`

---

### Quest 1: The App Shell ✅

**Status:** Complete.

The sidebar layout lives in `pages/index.vue` (not `App.vue`). `App.vue` stays thin:
`ReadinessGate > RouterView + ClipboardToast + PasteToast`.

`pages/index.vue` provides:
- `SidebarProvider` wrapping `ResizablePanelGroup`
- Left panel: `AppSidebar` (search, sort, tree, new/generate, context menu, hotkeys)
- Right panel: `EntryDetail` (secret display, metadata, CRUD actions)

**Deviation from original plan:** Search is in `AppSidebar` (not header), no separate `SidebarTrigger`/hamburger. This is fine — the sidebar is always visible via resizable panel.

---

### Quest 2: The Passwords Page ✅

**Status:** Complete.

The passwords page IS `pages/index.vue`. It's the main (and only functional) page.

Two-panel layout with:
- Left: `AppSidebar` with `Tree` component, search, sort, context menu, hotkeys (Mod+C/X/V)
- Right: `EntryDetail` with secret toggle, copy, metadata, notes, and action bar (duplicate, edit, rename, move, delete)

All CRUD dialogs exist: `EntryForm`, `DeleteConfirmDialog`, `RenameEntryDialog`, `MoveEntryDialog`, `DuplicateEntryDialog`, `CreateFolderDialog`, `PasswordGenerator`.

---

### Quest 3: The Settings Page

**Where to work:** Create `client/src/pages/settings.vue`

**What to build:**

Config editing form with sections:

1. **General**: Active store dropdown (from config `stores` keys)
2. **Generation**: Default password length input, symbols toggle
3. **Clipboard**: Clear timeout (seconds) input
4. **GPG Info** (read-only): Binary, version, home directory, secret key count

On mount, load config via `ConfigService.load()`. Each section has a Save button that writes via `ConfigService.setValue()` + `ConfigService.save()`.

**Router:** Add route for `/settings` (auto-router from `pages/` dir handles this).

**Done when:** Settings loads current config, changes persist on save, re-loading shows saved values.

---

### Quest 4: The Clean Sweep

**Where to work:** `client/src/pages/`

**What to delete:**

- `test.vue` - old auto-router artifact (empty test harness, no real functionality)

**Note:** `about.vue` already deleted. `index.vue` is the main page — do NOT delete it.

**Verify**: No remaining imports of `test.vue` anywhere.

**Done when:** `pages/` directory only has `index.vue` (and `settings.vue` after Quest 3).

---

## Verification

- `pnpm typecheck` - zero errors
- `pnpm lint && pnpm format` - zero issues
- App shell renders with resizable sidebar
- Sidebar shows search, sort, tree, new/generate buttons
- Passwords page shows tree on left, detail on right
- Clicking entry shows detail, empty state when nothing selected
- Settings page loads config, saves changes
- Old pages deleted, no orphan imports
- Ready dependencies already met
