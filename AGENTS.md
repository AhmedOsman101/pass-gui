# Pass GUI

Use `mask` task runner for running tasks. Never use `pnpm` or `podman` directly unless you absolutely need to, even then ask first.

## External resources (MANDATORY before writing code)

`docs/external-resources/` contains vendored documentation and source for every
third-party dependency: Neutralino (C++ **and** JS source), pass (man page +
shell source), GnuPG man pages, j-toml, vitest, playwright, tanstack-hotkey.

- **Consult it BEFORE implementing anything that touches a third-party API.**
  Check whether the facility you're about to write already exists
  (e.g. `filesystem.getPathParts` → `PathParts` covers path splitting).
- The directory is **gitignored**, so `fd`/Grep skip it. Use
  `fd-all --exclude node_modules` (or `rg --no-ignore`) to search it.
- For Neutralino behavior, the **source code is the source of truth** —
  `neutralino-cpp/api/**` (C++ implementation) and `neutralino-js/**`.
  The Markdown docs under `neutralino/docs` may be outdated.
