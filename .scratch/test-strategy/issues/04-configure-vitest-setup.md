# 04: Configure Vitest setup and project structure

Type: research
Status: open
Blocked by:

## Question

Design the Vitest configuration and project structure for the test suite.

Needs to resolve:

1. **Config file** — Separate `vitest.config.ts` vs inline in `vite.config.ts`? (vite.config.ts already exists with VueRouter + Vue + Tailwind + Neutralino plugins — may want separation to avoid plugin conflicts during test runs.)
2. **Environment** — `node` for lib tests, `jsdom` or `happy-dom` for component tests? The app uses NeutralinoJS (not browser DOM), so what makes sense?
3. **Globals** — `globals: true` (describe/it/expect without imports) or explicit imports?
4. **Plugins** — Which Vite plugins to disable during test (vueDevTools, neutralino)?
5. **Coverage config** — Provider (v8/istanbul), reporters, `include` patterns, `exclude` patterns, thresholds
6. **Setup file** — What goes in `setupFiles`: global mock initialization, cleanup hooks?
7. **Projects** — Monorepo-style Vitest projects for unit vs integration: `vitest.workspace.ts` or `projects` config?
8. **Pool** — `forks` (default in v5) vs `threads` vs `vmForks`? `@neutralinojs/lib` mocking may need isolation.
9. **Type testing** — Whether to use Vitest's `expectTypeOf` for type-level tests on the lib layer.

## Deliverables

Concrete `vitest.config.ts` file content (as an appendix in the strategy doc), including:
- Full config object with all options
- Setup file contents
- `package.json` script entries
- `.gitignore` additions (`.vitest/`)
- Coverage configuration
