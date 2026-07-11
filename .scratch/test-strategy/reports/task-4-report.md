# Task 4 Report: CI/CD Workflow

## Summary

Created `.github/workflows/ci.yml` — a single-job GitHub Actions workflow with three conditional trigger levels for pass-gui's Vue 3 + NeutralinoJS desktop app.

## YAML Structure

```yaml
name: CI/CD
on:
  push:
    branches: ["**"]
    tags: ["v*"]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - pnpm/action-setup (v11.9.0)
      - setup-node (Node 24, pnpm cache)
      - pnpm install --frozen-lockfile
      - typecheck          # Level 1 — all pushes
      - lint                # Level 1
      - test:unit           # Level 1
      - test:coverage       # Level 2+ — if: PR || tag
      - docker build        # Level 2+ — build Containerfile.test
      - docker run integ    # Level 2+ — run integration tests in container
      - build               # Level 3 — if: tag v*
      - release             # Level 3 — if: tag v*
```

## Files Created

| File | Action |
|------|--------|
| `.github/workflows/ci.yml` | Created |
| `.scratch/test-strategy/issues/06-ci-cd-workflow-yaml.md` | Updated (resolved) |
| `.scratch/test-strategy/map.md` | Updated (decision entry) |
| `.scratch/test-strategy/reports/task-4-report.md` | Created |

## Assumptions & Decisions

### Single job vs. multi-job
Chose a **single job** for simplicity. Multi-job would require built artifacts to be shared between jobs (via upload-artifact/download-artifact), adding complexity with no real benefit for this project's size. If build times become a concern, the job can be split later.

### Conditional steps over conditional jobs
Used `if:` on individual steps rather than separate jobs. This keeps the configuration flat and avoids duplicating the setup steps (checkout, pnpm, install) across multiple jobs.

### Docker availability
GitHub's `ubuntu-latest` runner has Docker pre-installed. No additional setup needed. The Containerfile.test builds in ~30s after initial pull.

### Coverage threshold
Coverage thresholds (warn < 60%, block < 75% new code) are configured in `vitest.config.ts`, not in the CI YAML. The `pnpm test:coverage` step runs the coverage reporter; if thresholds are not met, vitest will exit non-zero and fail the step automatically.

### No matrix strategy
NeutralinoJS can build for Linux, macOS, and Windows, but:
- `neu build` requires platform-specific tooling (binutils on Linux)
- Running cross-platform builds would require macOS/Windows runners (cost)
- The repo's `pnpm release` only produces the Linux build currently
- A matrix can be added later if cross-platform releases are needed

### Integration test workdir
The Docker container mounts the workspace at `/app` and sets `-w /app`. The `pnpm install --frozen-lockfile` inside the container reuses the lockfile from the mounted workspace. The pnpm store is **not** shared with the host — the container downloads its own store (typically ~30s). If this becomes slow, a Docker volume can be added for store caching.
