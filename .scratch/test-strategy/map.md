# Wayfinder Map: Test Strategy

## Destination

✅ **REACHED** — `TEST_STRATEGY.md` at project root. 845 lines covering every layer.
A builder agent can pick this up and implement tests for every layer.

## Notes

- **Domain:** test infrastructure, CI/CD, containerization, mocking
- **Skills to consult per session:** `vitest`, `TDD`, `grilling`, `research`, `vue-best-practices`, `lib-result`, `design-doc-mermaid`
- **Standing preferences:**
  - Vitest for all layered testing (unit, integration, coverage)
  - `vi.mock("@neutralinojs/lib")` for I/O mock strategy — module-level mocking, zero code changes
  - Hybrid sandbox: mocked unit tests + Podman-backed integration suite for GPG/pass
  - GitHub Actions for CI (Docker), Podman locally (compatible Containerfile)
  - Co-located unit tests (`parse-pass-show.test.ts` next to `parse-pass-show.ts`); separate `tests/integration/` for Podman suite
  - Tiered coverage: warn < 60% total, PR block < 75% new code, target 80% total
  - Priority: P0 pure lib -> P1 shell/path -> P2 service orchestration -> P3 stores/composables -> P4 core services -> P5 components -> P6 Podman integration
  - TDD/Integration-style tests: test behavior through public interfaces, mock at system boundaries, no tautological tests

## Decisions so far

- [Framework choices per layer](issues/04-configure-vitest-setup) — Vitest for all: lib (pure functions), services (mocked I/O), stores (@pinia/testing), components (Vue Test Utils). One recommended approach per layer with reasoning inline.
- [NeutralinoJS mock strategy](issues/01-investigate-neu-api-surface) — `vi.mock("@neutralinojs/lib")` at module level (Option B). Zero code changes, clean boundary, Vitest's native mocking.
- [Mock surface documented](.scratch/test-strategy/mock-surface.md) — Full inventory of all 10 source files importing from `@neutralinojs/lib`, exact signatures, auto-mock file template, and gotchas (init side-effects, NL_OS global, error shape). Ticket #15 resolved.
- [Sandbox and integration strategy](issues/02-design-podman-containerfile) — Hybrid: mocked unit tests for speed, Podman-backed integration tests for real GPG/pass verification. Node.js `child_process` as test harness inside container (NeutralinoJS can't run in Node.js context).
- [Container design resolved](issues/02-design-podman-containerfile) — Alpine-based `Containerfile.test` at project root, GPG/pass/git/pnpm preinstalled, 38.7 MiB image. `tests/integration/gpg-pass.test.ts` proof-of-concept test verifies full GPG->pass flow. Ticket #16 resolved.
- [File organization](issues/04-configure-vitest-setup) — Co-located `.test.ts` files next to source modules. Integration tests in separate `tests/integration/` directory.
- [Priority order](issues/04-configure-vitest-setup) — P0 (pure lib) -> P1 (shell/path) -> P2 (service orchestration) -> P3 (stores/composables) -> P4 (core services) -> P5 (components) -> P6 (Podman integration).
- [Coverage thresholds](issues/04-configure-vitest-setup) — Warning < 60% total (CI log, non-blocking), PR Block < 75% new code (blocks merge), Target 80% total (quarterly aspirational), Integration 100% pass (hard block). Exemptions: generated code, shadcn-vue UI components, type-only files.
- [CI/CD provider](issues/06-ci-cd-workflow-yaml) — GitHub Actions. Docker in CI, Podman locally. CI/CD YAML handled as a separate implementation ticket after the strategy doc is complete.
- [Component test scope](issues/03-define-component-test-scope) — **Resolved via task-1-report.** 7 core components warrant full mount tests (EntryForm, Tree, AppSidebar, AddStoreWizard, GpgTab, StoresTab, EntryDetail) + 3 lightweight dialog tests (CreateFolderDialog, RenameEntryDialog, MoveOrDuplicateDialog). All others exempt: dialog passthroughs, shadcn-vue wrappers, form-binding tabs, readiness screens, pages, and icons. See `.scratch/test-strategy/reports/task-1-report.md` for full per-component analysis.
- [Vitest config implemented](issues/04-configure-vitest-setup) — **Resolved via task-2.** Separate `vitest.config.ts`, happy-dom environment, `vi.hoisted()` mock factory in setup.ts, test scripts added. See `.scratch/test-strategy/reports/task-2-report.md`.
- [Store test patterns](issues/05-define-store-test-patterns) — **Resolved via task-3.** 5 patterns defined: setup store (ActiveStore, service-level mock), CRUD store (EntryTree, `vi.mock("@/services/entries")`), timer store (Clipboard, `vi.useFakeTimers()`), composable with store coupling (useTreeState, `createTestingPinia`), crypto composable (usePasswordGenerator, `vi.stubGlobal`). See `.scratch/test-strategy/reports/task-3-report.md`.
- [CI/CD workflow](issues/06-ci-cd-workflow-yaml) — **Resolved via task-4.** Single-job `.github/workflows/ci.yml` with three conditional trigger levels: Quick (all pushes: typecheck + lint + test:unit), Full (PR/tag: + coverage + Docker integration tests), Release (tag v\*: + build + release). Concurrency cancel-in-progress. pnpm/action-setup for caching. Docker-in-GHA for integration tests. See `.scratch/test-strategy/reports/task-4-report.md`.

## Not yet specified

- **Vitest config specifics** — (graduated to ticket 04)
- **Mock helper library** — whether to create shared mock factories for `@neutralinojs/lib` exports (e.g., `createMockNeu()`, `createMockFs()`) or inline per test file. Suspect shared factory but needs a decision.
- **Fixture management** — how to organize test fixtures (sample GPG output, sample entry data) for the Podman integration suite.

## Out of scope

- Actual test implementation — the strategy doc specifies what to test and how; writing the tests themselves is downstream work.
- Frontend E2E testing (Playwright/Cypress) — the app is a NeutralinoJS desktop app, not a web app. E2E testing would require running the full NeutralinoJS binary with a virtual display. Worth investigating but out of scope for this strategy effort.
- Performance/benchmark testing — Vitest has benchmarking support but benchmarking pass/gpg operations isn't meaningful.
- `@neutralinojs/lib` DI refactor — Option B (module-level mocking) means no code changes needed. A DI refactor would be a separate effort if mocking proves insufficient.
