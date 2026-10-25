# Pass GUI

Use `mask` task runner for running tasks. Never use `pnpm` or `podman` directly unless you absolutely need to, even then ask first.
Consolidate all named exports (`export { ... }`) and type exports (`export type { ... }`) at the very end of the file; strictly avoid using inline `export` keywords during variable, function, or type declaration. This is more clear, one look at the top and bottom tells you what this code imports and exports.

## External resources (MANDATORY before writing code)

`docs/external-resources/` contains vendored documentation and source for every
third-party dependency: Neutralino (C++ **and** JS source), pass (man page +
shell source), GnuPG man pages, j-toml, tanstack-hotkey.

- **Consult it BEFORE implementing anything that touches a third-party API.**
  Check whether the facility you're about to write already exists
  (e.g. `filesystem.getPathParts` → `PathParts` covers path splitting).
- The directory is **gitignored**, so `fd`/Grep skip it. Use
  `fd-all --exclude node_modules` (or `rg --no-ignore`) to search it.
- For Neutralino behavior, the **source code is the source of truth** —
  `neutralino-cpp/api/**` (C++ implementation) and `neutralino-js/**`.
  The Markdown docs under `neutralino/docs` may be outdated.

## Running mask tasks

Choose the right tool for the job instead of cutting context blindly
with `head`/`tail` pipes (forbidden pattern: `mask lint 2>&1 | tail -3`).
The dedicated `--reporter` flag (placed after the subcommand) shapes
the output:

- `--reporter concise` — shortest output; quick "is everything OK"
  checks or minimal token usage.
- `--reporter summary` — grouped overview of everything found.
- no flag — full output, when details are the point.

```sh
mask lint --reporter concise
mask format --reporter summary
```

(`typecheck` has no `--reporter`; its output is short enough on its own.)

## Formatting before committing

Always run `mask format` before committing your changes — and pick it
in favor of `mask lint`, not in addition to it. `format` fixes lint
problems and reports any that remain; `lint` only checks. Running both
is redundant. If you forgot to format and notice that the post-commit
script says "N file(s) were formatted", then use this to commit these
changes:

```sh
git add -A
# or stage the specific formatted files
# then:
git commit --amend --no-edit --no-verify
```

(Remember to stage them first.)

## Committing

- Keep commits small and atomic: one logical change per commit. Split
  work into multiple commits instead of one blob.
- Subject + body is a judgment call, not a default: a commit with lots
  of changes deserves a body describing what (and why); a small
  single-purpose commit may be subject-only.
- Conventional Commits subjects: `type(scope): summary` with
  feat/fix/docs/chore/build/refactor.
- When a commit involves a tracked issue, reference it as a trailing
  footer at the very end of the commit body:

```sh
git commit -m "feat(scope): summary" -m "Body paragraph." -m "Refs: closes #25."
```

## Agent skills

### Issue tracker

GitHub Issues via `gh`; bodies staged locally under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles + wayfinder ticket types, used as-is. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` glossary + `docs/adr/`. See `docs/agents/domain.md`.
