# 02: Design Podman Containerfile for GPG/pass integration tests

Type: research
Status: resolved
Blocked by:

## Question

Design the Containerfile (Dockerfile-compatible for CI) that will host GPG/pass integration tests.

## Decisions

### 1. Base image — `node:24-alpine`

**Chosen: Alpine.** We started with `node:24-slim` (Debian) but it pulled 197 packages/107 MB including X11 and dbus — build took >3 minutes. Alpine is 38.7 MiB with 64 packages, build completes in ~30 seconds.

Rationale:
- GPG/pass are pure CLI tools in this context (no pinentry UI needed)
- Alpine's `musl` has no compatibility issues with the tools we run (gpg, pass, git)
- CI builds are significantly faster
- Same Node 24, same pnpm 11.9.0

### 2. GPG key generation — `gpg --batch --gen-key` with batch config file

Non-interactive key generation works with a batch config:
```
Key-Type: RSA
Key-Length: 2048
Subkey-Type: RSA
Subkey-Length: 2048
Name-Real: pass-gui Test
Name-Email: test@pass-gui.local
Expire-Date: 0
%no-protection
%commit
```

### 3. pass initialization

Standard `pass init <email>` works inside the container. `PASSWORD_STORE_DIR` env var controls store location.

### 4. Test runner

Mount the project root at `/app` and run inside the container:
```bash
podman run --rm -v $(pwd):/app -w /app pass-gui-test \
  bash -c "pnpm install --frozen-lockfile && pnpm --filter=client vitest run tests/integration/"
```

### 5. Multiple GnuPG homes

Set `GNUPGHOME` env var per-operation. The proof-of-concept test (`tests/integration/gpg-pass.test.ts`) includes a test case that creates a second GPG key in a separate `GNUPGHOME` and a separate `PASSWORD_STORE_DIR`, then verifies isolation.

### 6. Node.js version

`node:24-alpine` provides Node 24.18.0 (matches the project's `@tsconfig/node24` and `@types/node ^24.10.7`).

### 7. pnpm setup

`npm install -g pnpm@11.9.0` inside the container (matches `"packageManager": "pnpm@11.9.0"` in root `package.json`).

## Deliverables

- [x] `Containerfile.test` at project root — Alpine-based, 38.7 MiB, GPG 2.4.9 + pass 1.7.4 + git + pnpm 11.9.0
- [x] `tests/integration/gpg-pass.test.ts` — Proof-of-concept integration test (GPG key gen, pass init, insert/show/ls/rm, multi-GNUPGHOME isolation, git integration)
- [x] `tests/integration/scripts/setup-test-store.sh` — Helper script for setting up test stores manually
- [x] Verified: container builds, GPG key gen works, pass init/insert/show works end-to-end

## How to build and test

```bash
# Build the image
podman build -t pass-gui-test -f Containerfile.test .

# Run the integration tests (requires vitest to be configured — see ticket #18)
podman run --rm -v $(pwd):/app -w /app pass-gui-test \
  bash -c "pnpm install --frozen-lockfile && pnpm --filter=client vitest run tests/integration/"

# Interactive shell for debugging
podman run --rm -v $(pwd):/app -w /app -it pass-gui-test
```
