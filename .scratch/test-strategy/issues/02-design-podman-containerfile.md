# 02: Design Podman Containerfile for GPG/pass integration tests

Type: research
Status: open
Blocked by:

## Question

Design the Containerfile (Dockerfile-compatible for CI) that will host GPG/pass integration tests.

Key decisions to resolve:

1. **Base image** — Alpine (small, but `pass` may need community repo) vs Debian slim (heavier, but `pass` and `gpg` are in main repos)?
2. **GPG key generation** — How to generate ephemeral GPG keys non-interactively in the container (`gpg --batch --gen-key`)?
3. **pass initialization** — How to set up a test password store with sample entries?
4. **Test runner** — How to run Vitest inside the container (mount source? copy? run a pre-built test bundle?).
5. **Multiple GnuPG homes** — Test per-store `GNUPGHOME` overrides.
6. **Node.js version** — Which Node.js version to install (matching the project's runtime).
7. **pnpm setup** — How to install pnpm and project dependencies inside the container.

## Deliverables

A `Containerfile.test` at the project root, a `tests/integration/` directory structure, and a small proof-of-concept test that verifies:
- A GPG key can be generated
- A pass store can be initialized
- `pass show` returns the expected output
