# 06: Implement GitHub Actions CI/CD workflow

Type: task
Status: resolved
Blocked by: 04, 02

## Resolution

Created `.github/workflows/ci.yml` with a single-job workflow covering three trigger levels:

### Level 1: Quick Check (push to any branch)
Trigger: `push` (any branch)
Steps:
- Checkout
- pnpm/action-setup@v4 (v11.9.0)
- setup-node@v4 (Node 24, pnpm cache)
- pnpm install --frozen-lockfile
- pnpm typecheck
- pnpm lint
- pnpm test:unit

### Level 2: Full Check (PR to main or tag push)
All of Level 1 plus:
- pnpm test:coverage (via `vitest run --coverage`)
- Build Docker image from Containerfile.test
- Run integration tests inside container

### Level 3: Release (tag push v*)
All of Level 2 plus:
- pnpm build
- pnpm release

### Design decisions
- **Single job** — simpler than multi-job, no shared-artifact complexity
- **Conditional steps** — `if:` expressions gate Level 2/3 steps by event type
- **Concurrency** — `concurrency.group` by ref, `cancel-in-progress: true`
- **Docker in CI** — direct `docker build`/`docker run` (Docker is available on ubuntu-latest)
- **Coverage threshold** — not enforced in CI YAML (configured in vitest.config.ts)
- **No matrix** — NeutralinoJS builds are cross-platform but CI runs on Linux only; binutils for neutralino only available on ubuntu-latest

### Files
- Created: `.github/workflows/ci.yml`
- Updated: `map.md` (decision entry)
- Report: `reports/task-4-report.md`
