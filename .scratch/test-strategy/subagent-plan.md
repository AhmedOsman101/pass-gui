# Subagent Plan: Remaining Test Strategy Tickets

## Global Constraints

- **Tech stack:** Vue 3.5 + Pinia 3 + NeutralinoJS 6.4 + TypeScript 5.9 + TailwindCSS 4 + shadcn-vue 2 + Vitest
- **Mock strategy:** `vi.mock("@neutralinojs/lib")` — module-level mocking, zero code changes
- **Mock surface:** Already documented in `.scratch/test-strategy/mock-surface.md`
- **Container:** Alpine-based `Containerfile.test` at project root
- **Code style:** Biome 2.5.0 (2 spaces, 80 char width, LF, double quotes, semicolons always)
- **Package manager:** pnpm@11.9.0
- **Node:** >=24
- **Working directory:** `/home/othman/work/desktop/pass-gui`
- **Make changes in the main project directory directly (no worktree needed)**

## Task 1 (Ticket #17): Define component test scope

**Status:** NOT_STARTED
**Blocked by:** none

**Brief:** Read `client/src/components/` and `client/src/pages/` directories. Examine the 7 identified components (EntryForm, Tree, AppSidebar, AddStoreWizard, GpgTab, StoresTab, EntryDetail). For each, document:
- Lines of code
- Non-trivial behaviors (form validation, keyboard nav, state transitions, API calls)
- What should be tested vs what should not
- The test pattern (Vue Test Utils harness + mocking setup)

**Deliverable:** Update `issues/03-define-component-test-scope.md` with full scoped list. Update `map.md` to mark ticket resolved.

**No code changes needed — just documentation.**

## Task 2 (Ticket #18): Configure Vitest

**Status:** NOT_STARTED
**Blocked by:** none

**Brief:** Install vitest, configure vitest.config.ts, set up test infrastructure:
1. `pnpm --filter=client add -D vitest happy-dom @pinia/testing @vue/test-utils`
2. Create `client/vitest.config.ts` — separate from vite.config.ts, use `happy-dom` environment, disable neutralino/vueDevTools plugins
3. Create `client/src/test/` directory with:
   - `setup.ts` — global mocks, cleanup hooks
   - `vitest.d.ts` — type declarations
4. Add test scripts to `client/package.json`: `test:unit`, `test:coverage`
5. Add `vitest.config.d.ts` if needed
6. Run `pnpm typecheck` to verify everything compiles
7. Record all files changed

**Deliverable:** Working vitest setup. Update `issues/04-configure-vitest-setup.md` with final config snapshot. Update `map.md`.

## Task 3 (Ticket #19): Define store test patterns

**Status:** NOT_STARTED
**Blocked by:** none (but references Pinia 3 + @pinia/testing)

**Brief:** Read `client/src/stores/` and `client/src/composables/` directories. Examine:
- 5 Pinia stores
- 4 composables
Document test patterns per type:
- Setup store test (ActiveStore)
- Store with service mocks (EntryTree)
- Timer-based store (Clipboard)
- Composable with store coupling (useTreeState)
- Crypto-dependent composable (usePasswordGenerator)

Include code examples showing the harness pattern for each type.

**Deliverable:** Update `issues/05-define-store-test-patterns.md`. Update `map.md`.

## Task 4 (Ticket #20): CI/CD workflow

**Status:** NOT_STARTED
**Blocked by:** Task 2 (needs vitest command names)

**Brief:** After vitest is configured (Task 2):
1. Create `.github/workflows/ci.yml`
2. Three trigger levels:
   - Quick (push to any branch): typecheck + lint + test:unit
   - Full (PR to main): Quick + test:coverage + test:integration (Docker)
   - Release (tag push): Full + build + release
3. Handle Docker-in-GHA for integration tests
4. Coverage threshold gates
5. Cancel in-progress runs on new pushes
6. Cache pnpm store + node_modules
7. Containerfile.test is already at project root

**Deliverable:** Working `.github/workflows/ci.yml`. Update `issues/06-ci-cd-workflow-yaml.md`. Update `map.md`.
