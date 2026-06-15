# Frontend UI — Implementation Plan

> **Spec**: `docs/specs/frontend-ui.md`
> **Roadmap**: `docs/roadmap/04-frontend-after-backend.md`
> **Depends on**: Phase 02 (readiness) + Phase 03 (entry ops) completely implemented

**Goal**: Build the UI that consumes the backend contracts, including Pinia
stores, readiness-driven app entry, and all core user flows.

**Architecture**: Implement Pinia stores that consume backend service contracts
without reimplementing logic. Use existing shadcn-vue components. Each screen
derives its state from stores, not from local UI state. Blocked states render
before the password list is ever shown.

**Tech Stack**: Vue 3 + Pinia + shadcn-vue + Vue Router + NeutralinoJS

---

## Assumptions

- Phase 02 (readiness) is complete: types, orchestrator, store validation exist.
- Phase 03 (entry ops) is complete: entry service, clipboard service, parsers,
  and state contracts exist.
- The app currently uses file-based auto-routing from `client/src/pages/`.

---

## New Files

| File | Purpose |
|------|---------|
| `client/src/stores/readiness.ts` | ReadinessStore — consumes readiness snapshot |
| `client/src/stores/entries.ts` | EntriesStore — entry list, search, selection |
| `client/src/stores/clipboard.ts` | ClipboardStore — clipboard action + timer state |
| `client/src/stores/store-context.ts` | StoreContextStore — active store info |
| `client/src/composables/useReadinessCheck.ts` | On-mount readiness check with auto-retry |
| `client/src/composables/useClipboardTimer.ts` | Reactive clipboard countdown timer |
| `client/src/pages/index.vue` | Rewrite: readiness router → password list or blocked screen |
| `client/src/pages/blocked.vue` | Blocked-state screen (shows readiness issues) |
| `client/src/pages/passwords.vue` | Password list + entry detail split view |
| `client/src/pages/settings.vue` | Settings page (config editing) |
| `client/src/components/PasswordTree.vue` | Sidebar entry tree (replaces sample data) |
| `client/src/components/EntryDetail.vue` | Entry detail panel (secret + metadata) |
| `client/src/components/EntryCreateDialog.vue` | Insert/generate entry dialog |
| `client/src/components/EntryRemoveDialog.vue` | Confirm removal dialog |
| `client/src/components/SearchBar.vue` | Search/filter input with debounce |
| `client/src/components/ClipboardIndicator.vue` | Timer indicator for clipboard |
| `client/src/components/BlockedState.vue` | Reusable blocked-state card |

## Modified Files

| File | Change |
|------|--------|
| `client/src/App.vue` | Wire sidebar, top bar, main content area |
| `client/src/components/AppSidebar.vue` | Replace hardcoded data with PasswordTree + StoreContext |
| `client/src/router/index.ts` | Add routes for blocked, passwords, settings pages |
| `client/src/stores/counter.ts` | Remove placeholder counter store |
| `TODO.md` | Mark frontend items done |

---

## Implementation Order

### Sub-phase 4.1: Pinia Stores

Implement all stores that the UI consumes. No components yet.

**`client/src/stores/readiness.ts`**
- State: `snapshot: ReadinessSnapshot | null`, `loading: boolean`,
  `lastCheckedAt: number | null`
- Actions: `checkReadiness()` calls readiness orchestrator, stores snapshot
- Getters: `isReady`, `blockingState`, `issues`
- On init, auto-check readiness if not already done

**`client/src/stores/entries.ts`**
- State: `tree: EntryTree | null`, `selectedPath: string | null`,
  `selectedDetail: EntryDetail | null`, `searchQuery: string`,
  `loading: boolean`
- Actions: `list()`, `refresh()`, `select(path)`, `search(query)`,
  `insert(input)`, `generate(input)`, `remove(path)`, `move(old, new)`
- Getters: `filteredTree` (applies search filter), `isLoading`, `error`
- Uses EntriesService for all backend calls

**`client/src/stores/clipboard.ts`**
- State: `lastAction: ClipboardAction | null`, `remainingSeconds: number`,
  `isActive: boolean`
- Actions: `copy(text)`, `clear()`, `abort()`
- Uses ClipboardService, updates reactive timer state periodically

**`client/src/stores/store-context.ts`**
- State: `activeStoreName: string | null`, `storePath: string | null`,
  `gnupgHome: string | null`
- Actions: `refresh()` pulls from readiness snapshot or ConfigService
- Simple data holder — no complex logic

### Sub-phase 4.2: Router + App Shell

Wire the routing structure and app layout.

**`client/src/router/index.ts`**

```
/             → redirect to /readiness
/readiness    → readiness check → /blocked or /passwords
/blocked      → Blocked screen (if not ready)
/passwords    → Password list (if ready)
/passwords/:path*  → Entry detail for specific path
/passwords/:path*/edit → Entry edit (future)
/settings     → Config editing
```

Use `beforeEach` navigation guard that checks readiness store and redirects
appropriately.

**`client/src/App.vue`**
- Layout: shadcn-vue SidebarProvider wrapping Sidebar + SidebarInset
- Sidebar contains AppSidebar
- SidebarInset contains top bar + RouterView

**`client/src/components/AppSidebar.vue`**
- Replace hardcoded sample data with StoreContext info at top, PasswordTree
  below, search bar in between
- Respect existing shadcn-vue Sidebar component structure

### Sub-phase 4.3: Blocked State Screen

**`client/src/pages/blocked.vue`**
- Reads readiness store `blockingState` and `issues`
- Shows blocking status with icon and description
- Lists individual issues with actionable guidance
- Retry button calls `readinessStore.checkReadiness()`
- No password list access until ready

**`client/src/components/BlockedState.vue`**
- Reusable card: icon + state name + description + action button
- One per readiness issue type

### Sub-phase 4.4: Password List View

**`client/src/pages/passwords.vue`**
- Two-panel layout:
  - Left: PasswordTree (entry list)
  - Right: EntryDetail (selected entry) or empty state
- On mount, calls `entriesStore.list()`
- Shows loading skeleton while entries load
- Shows empty state for stores with no entries

**`client/src/components/PasswordTree.vue`**
- Replaces the sample-data-driven Tree component
- Recursive tree from `entriesStore.filteredTree`
- Collapsible folders (use existing shadcn-vue Collapsible)
- Click to select, double-click to toggle folder
- Active selection highlighted
- Search filter from SearchBar applied in real time

**`client/src/components/SearchBar.vue`**
- Text input with debounce (300ms)
- Calls `entriesStore.search(query)` on input
- Clear button to reset search
- Shows result count or "no matches"

### Sub-phase 4.5: Entry Detail Panel

**`client/src/components/EntryDetail.vue`**
- Header: entry path/filename
- Secret display: masked by default, toggle to reveal
- Copy button with ClipboardIndicator
- Metadata table: key-value pairs from entry detail
- Action buttons: Edit (future), Remove (with confirmation)
- Uses ClipboardStore for copy action

### Sub-phase 4.6: Entry Mutation Dialogs

**`client/src/components/EntryCreateDialog.vue`**
- Mode toggle: Insert (paste content) vs. Generate (auto password)
- Insert mode: path input + content textarea + metadata fields
- Generate mode: path input + length slider + symbol toggle
- Validates path before submitting
- Shows result with option to copy generated password immediately

**`client/src/components/EntryRemoveDialog.vue`**
- Shows entry path being removed
- Confirmation checkbox: "I understand this cannot be undone"
- Remove button disabled until confirmation checked
- Result message on success or error

### Sub-phase 4.7: Clipboard UX

**`client/src/composables/useClipboardTimer.ts`**
- Reactive countdown that ticks every second
- Starts when clipboard write occurs
- Emits `onClear` when timer expires
- Abort function to cancel early

**`client/src/components/ClipboardIndicator.vue`**
- Inline indicator next to copy button
- States: idle, copying (spinner), active (countdown), cleared (checkmark)
- Shows remaining seconds during active state

### Sub-phase 4.8: Settings Page

**`client/src/pages/settings.vue`**
- Sections matching config structure:
  - General: active store selector, auto-refresh interval
  - Generation: password length, symbol toggle
  - Clipboard: clear timeout, selection type
  - GPG: read-only display of GPG info
- Each section loads current config values
- Save button writes changes via ConfigService
- Validation errors shown inline
- Store switch triggers readiness re-check

---

## Verification

```bash
pnpm typecheck                              # Must pass
pnpm lint && pnpm format                    # Must pass
pnpm dev                                    # Must start without errors
```

Manual scenario verification:

1. **No pass binary**: App shows DEPENDENCIES_MISSING with actionable guidance.
2. **No GPG keys**: App shows GPG_NOT_INITIALIZED with guidance.
3. **No store**: App shows STORE_NOT_FOUND with creation option.
4. **Valid setup**: App shows password list from active store.
5. **Entry selection**: Click entry → detail panel shows secret + metadata.
6. **Copy to clipboard**: Click copy → clipboard indicator shows countdown.
7. **Entry creation**: Create a new entry → it appears in the tree.
8. **Password generation**: Generate a password → entry created + copyable.
9. **Entry removal**: Remove an entry → tree updates, detail panel clears.
10. **Search**: Type in search → tree filters to matching entries.
11. **Settings**: Change config values → save → values persist on reload.
12. **Dark mode**: Toggle → all screens render correctly in dark mode.

---

## Risks And Watchouts

- **Auto-routing vs. manual routing**: The project uses `vue-router/auto-routes`
  from the `pages/` directory. Adding custom routes may require switching to
  manual route definitions or adding route overrides. Verify compatibility
  before restructuring the router.
- **Empty stores**: The tree must handle 0 entries gracefully, not as an error.
- **Deeply nested stores**: Test with stores containing 3+ levels of folders.
- **Long secret values**: Password display must handle values > 100 characters.
- **Search performance**: For stores with 1000+ entries, debounce search and
  consider virtual scrolling, but defer virtual scrolling to post-MVP.
- **Sidebar layout**: shadcn-vue Sidebar components expect a specific provider
  hierarchy. Follow the shadcn-vue sidebar example structure exactly.

---

## Progress Tracking

Update `TODO.md` sections when complete:

- Section 4 (App State Machine) — mark all items
- Section 5 (Listing Passwords) — mark remaining UI items
- Section 6 (Multiple Store Support) — mark switching in settings
- Section 8 (Entry Operations) — mark UI items
- Section 12 (Configuration) — mark settings UI items
