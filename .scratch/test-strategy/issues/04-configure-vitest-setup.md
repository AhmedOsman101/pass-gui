# 04: Configure Vitest setup and project structure

Type: implementation
Status: resolved

## Resolution

Vitest infrastructure fully configured. See `reports/task-2-report.md` for details.

## Final Config Snapshot

### `client/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**"],
      exclude: [
        "src/test/**",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/components/ui/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
```

### Directory Layout

```
client/
├── vitest.config.ts              # Separate from vite.config.ts
├── src/
│   ├── test/
│   │   ├── setup.ts              # Global NeutralinoJS mock + cleanup
│   │   ├── vitest.d.ts           # Vitest type declarations
│   │   └── smoke.test.ts         # Minimal smoke test
│   └── __mocks__/                # (future use for auto-mock files)
└── package.json                  # test:unit, test:watch, test:coverage scripts
```

### Decisions Applied

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Config file | Separate `vitest.config.ts` | Avoids neutralino/vueDevTools plugin conflicts |
| Environment | `happy-dom` | Lightweight, enough DOM for Vue Test Utils |
| Globals | `true` | `describe`/`it`/`expect` without imports |
| Plugins | `vue()` only | No vueDevTools or neutralino in test config |
| Coverage | `v8` provider | Built-in, zero extra deps |
| Pool | `forks` (default) | Isolates `vi.mock` per worker |
| Setup | `setup.ts` with `vi.hoisted()` | Factory function avoids hoisting issues |

### Scripts

```jsonc
// client/package.json
"test:unit": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"

// root package.json
"test": "pnpm --filter=client test:unit",
"test:integration": "echo 'Integration tests: run inside Podman container'"
```

### Mock Strategy

- `setup.ts` uses `vi.hoisted()` factory + `vi.mock("@neutralinojs/lib")`
- Covers all 70+ exports (init, os, filesystem, clipboard, events, debug + stubs)
- `window.NL_OS` mocked as global separately (not from module import)
- Error shape: `{ code: ErrorCode, message: string }`
