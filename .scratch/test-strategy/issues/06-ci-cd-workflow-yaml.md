# 06: Implement GitHub Actions CI/CD workflow

Type: task
Status: open
Blocked by: 04, 02

## Question

Create the GitHub Actions workflow YAML for the test suite.

This is blocked until:
- **Ticket 04** is resolved (Vitest config is designed — needed to know what commands to run)
- **Ticket 02** is resolved (Podman Containerfile — needed for the integration test job)

When unblocked, implement `.github/workflows/ci.yml` with:

1. **Quick check (push to any branch):** `pnpm typecheck` + `pnpm lint` + `pnpm test:unit`
2. **Full check (PR to main):** Quick + `pnpm test:coverage` + `pnpm test:integration` (Docker-based)
3. **Release (tag push):** Full + `pnpm build` + `neu build --release`

Needs to handle:
- Docker-based integration tests (Docker-in-GHA; Podman-locally with compatible Containerfile)
- Coverage reporting with threshold gates (75% new code)
- Cancelling in-progress runs on new pushes
- Caching pnpm store + node_modules
- Matrix strategy? (macOS/Windows/Linux? — NeutralinoJS is cross-platform)
