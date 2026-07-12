# Task 2 Report: Configure Vitest Test Infrastructure

**Date:** 2026-07-11
**Status:** DONE

## What Was Implemented

1. **Installed packages** (client devDependencies):
   - `vitest` (v4.1.10)
   - `happy-dom`
   - `@pinia/testing`
   - `@vue/test-utils`

2. **Created `client/vitest.config.ts`** — separate from vite.config.ts
   - Uses only `@vitejs/plugin-vue` (no neutralino/vueDevTools plugins)
   - `happy-dom` environment for component tests
   - `globals: true` for describe/it/expect without imports
   - `@` alias matching vite config
   - Coverage: v8 provider, 60% thresholds, excludes test/ + shadcn-vue wrappers
   - `setupFiles: ["./src/test/setup.ts"]`

3. **Created `client/src/test/setup.ts`** — global test setup
   - `vi.hoisted()` factory `createMockNeu()` returning comprehensive NeutralinoJS mock
   - `vi.mock("@neutralinojs/lib")` using the factory
   - All 70+ exports covered: init, os (16 fn), filesystem (30 fn), clipboard (8 fn), events (4 fn), debug (1 fn), app/computer/storage/resources/server/updater/custom stubs, and enum mocks (OperatingSystem, Icon, MessageBoxChoice, LoggerType, ClipboardFormat)
   - `window.NL_OS` and `window.NL_HOME_DIR` global mocks
   - `__NEU_MOCK__` flag for test detection

4. **Created `client/src/test/vitest.d.ts`** — type declarations for globals

5. **Created `client/src/test/smoke.test.ts`** — minimal test to verify setup

6. **Updated `client/package.json`** with scripts:
   - `test:unit` -> `vitest run`
   - `test:watch` -> `vitest`
   - `test:coverage` -> `vitest run --coverage`

7. **Updated root `package.json`** with:
   - `test` -> delegates to client's test:unit
   - `test:integration` -> placeholder for Podman container

8. **Updated deliverable files:**
   - `.scratch/test-strategy/issues/04-configure-vitest-setup.md` — resolved with final config snapshot
   - `.scratch/test-strategy/map.md` — added Vitest config decision entry

## Test Results

```
✓ src/test/smoke.test.ts (1 test) 3ms

Test Files  1 passed (1)
     Tests  1 passed (1)
  Start at  21:46:36
  Duration  418ms
```

## Files Created

| File                                              | Purpose                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `client/src/test/setup.ts`                        | Global test setup with NeutralinoJS mock factory    |
| `client/src/test/vitest.d.ts`                     | Vitest global type declarations                     |
| `client/src/test/smoke.test.ts`                   | Minimal smoke test                                  |
| `client/vitest.config.ts`                         | Vitest configuration (separate from vite.config.ts) |
| `.scratch/test-strategy/reports/task-2-report.md` | This report                                         |

## Files Modified

| File                                                         | Change                                             |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `client/package.json`                                        | Added test:unit, test:watch, test:coverage scripts |
| `package.json` (root)                                        | Added test and test:integration scripts            |
| `.scratch/test-strategy/issues/04-configure-vitest-setup.md` | Replaced with resolved version + final config      |
| `.scratch/test-strategy/map.md`                              | Added Vitest config decision entry                 |

## Issues / Concerns

**None.** Typecheck passes, vitest smoke test passes. The mock factory is comprehensive and ready for service-level tests.
