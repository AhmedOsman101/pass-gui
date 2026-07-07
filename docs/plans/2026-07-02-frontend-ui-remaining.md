# Frontend UI Remaining — Quest Chain

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

## Progress

- [ ] Quest 1: The App Shell
- [ ] Quest 2: The Passwords Page
- [ ] Quest 3: The Settings Page
- [ ] Quest 4: The Clean Sweep

**Goal:** Complete the remaining frontend work — app shell with sidebar layout, passwords page (two-panel tree + detail), settings page, and cleanup of old artifacts.

## Prerequisites

- Phase 04 stores all exist: readiness, entries, clipboard, active-store
- Components exist: Tree (flat renderer), EntryDetail, AppSidebar, dialogs, BlockedScreen, IssueCard, ClipboardToast
- `@vueuse/core` available for debounce (already used)

---

### Quest 1: The App Shell

**Where to work:** `client/src/App.vue`

**What to build:**

Replace the bare `ReadinessGate > RouterView + ClipboardToast` with a full shadcn-vue sidebar layout:

- `SidebarProvider` wrapping `Sidebar` + `SidebarInset`
- `Sidebar` contains `AppSidebar` component
- `SidebarInset` has a header with:
  - `SidebarTrigger` (hamburger)
  - Search input (wired to entries store debounce)
  - `ModeToggle`
  - Settings button (router-link to `/settings`)
- Main area renders `<RouterView />` inside the inset
- `ClipboardToast` stays as a floating element

**Keep** `ReadinessGate` wrapping — it controls blocked vs. ready rendering.

**Done when:** App shell renders with collapsible sidebar, header with search/mode/settings, and router view below.

---

### Quest 2: The Passwords Page

**Where to work:** Create `client/src/pages/passwords.vue`

**What to build:**

Two-panel layout:

- **Left panel**: scrollable area with `<Tree />` (flat renderer, already exists)
- **Right panel**: `EntryDetail` when selected, or empty state "Select a password to view" when nothing selected

**Empty state**: A centered message when `entries.currentEntry` is null — "Select a password to view its details."

**Done when:** Tree shows entries on the left, clicking a file shows its detail on the right. Works with readiness gate.

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

**Done when:** Settings loads current config, changes persist on save, re-loading shows saved values.

---

### Quest 4: The Clean Sweep

**Where to work:** `client/src/pages/`

**What to delete:**

- `about.vue` — old auto-router artifact
- `test.vue` — old auto-router artifact
- `index.vue` — old auto-router artifact (sidebar layout moved to App.vue)

**Verify**: No remaining imports of these files anywhere.

**Done when:** `pages/` directory only has new pages (passwords, settings, plus any future ones).

---

## Verification

- `pnpm typecheck` — zero errors
- `pnpm lint && pnpm format` — zero issues
- App shell renders with collapsible sidebar
- Header shows search, mode toggle, settings button
- Passwords page shows tree on left, detail on right
- Clicking entry shows detail, empty state when nothing selected
- Settings page loads config, saves changes
- Old pages deleted, no orphan imports
- Ready dependencies already met
