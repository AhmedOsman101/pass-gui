import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

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
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "**/__tests__/**.test.ts",
    ],
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
