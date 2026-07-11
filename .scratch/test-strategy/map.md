# Wayfinder Map: Test Strategy

## Destination

A **Test Strategy Document** — the finalized specification of framework choices, mock strategy, test hierarchy, CI pipeline, priority-ordered module list, and container strategy for pass-gui's test suite. When the map is done, a builder agent can pick up the strategy doc and implement tests for every layer of the app.

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
  - Priority: P0 pure lib → P1 shell/path → P2 service orchestration → P3 stores/composables → P4 core services → P5 components → P6 Podman integration
  - TDD/Integration-style tests: test behavior through public interfaces, mock at system boundaries, no tautological tests

## Decisions so far

- [Framework choices per layer](issues/04-configure-vitest-setup) — Vitest for all: lib (pure functions), services (mocked I/O), stores (@pinia/testing), components (Vue Test Utils). One recommended approach per layer with reasoning inline.
- [NeutralinoJS mock strategy](issues/01-investigate-neu-api-surface) — `vi.mock("@neutralinojs/lib")` at module level (Option B). Zero code changes, clean boundary, Vitest's native mocking.
- [Sandbox and integration strategy](issues/02-design-podman-containerfile) — Hybrid: mocked unit tests for speed, Podman-backed integration tests for real GPG/pass verification. Node.js `child_process` as test harness inside container (NeutralinoJS can't run in Node.js context).
- [File organization](issues/04-configure-vitest-setup) — Co-located `.test.ts` files next to source modules. Integration tests in separate `tests/integration/` directory.
- [Priority order](issues/04-configure-vitest-setup) — P0 (pure lib) → P1 (shell/path) → P2 (service orchestration) → P3 (stores/composables) → P4 (core services) → P5 (components) → P6 (Podman integration).
- [Coverage thresholds](issues/04-configure-vitest-setup) — Warning < 60% total (CI log, non-blocking), PR Block < 75% new code (blocks merge), Target 80% total (quarterly aspirational), Integration 100% pass (hard block). Exemptions: generated code, shadcn-vue UI components, type-only files.
- [CI/CD provider](issues/06-ci-cd-workflow-yaml) — GitHub Actions. Docker in CI, Podman locally. CI/CD YAML handled as a separate implementation ticket after the strategy doc is complete.
- [Component test scope](issues/03-define-component-test-scope) — Not all components warrant tests. Only components with non-trivial logic: EntryForm, Tree, AppSidebar, and settings tabs with complex interaction (AddStoreWizard, GpgTab, StoresTab). Dialog passthroughs and shadcn-vue wrappers are exempt.

## Not yet specified

- **Podman container specifics** — (graduated to ticket 02)
- **Vitest config specifics** — (graduated to ticket 04)
- **Store test patterns** — (graduated to ticket 05)
- **CI workflow YAML** — (graduated to ticket 06)
- **Mock helper library** — whether to create shared mock factories for `@neutralinojs/lib` exports (e.g., `createMockNeu()`, `createMockFs()`) or inline per test file. Suspect shared factory but needs a decision.
- **Fixture management** — how to organize test fixtures (sample GPG output, sample entry data) for the Podman integration suite.

## Out of scope

- Actual test implementation — the strategy doc specifies what to test and how; writing the tests themselves is downstream work.
- Frontend E2E testing (Playwright/Cypress) — the app is a NeutralinoJS desktop app, not a web app. E2E testing would require running the full NeutralinoJS binary with a virtual display. Worth investigating but out of scope for this strategy effort.
- Performance/benchmark testing — Vitest has benchmarking support but benchmarking pass/gpg operations isn't meaningful.
- `@neutralinojs/lib` DI refactor — Option B (module-level mocking) means no code changes needed. A DI refactor would be a separate effort if mocking proves insufficient.
