# pass-gui Documentation

## Directory Structure

```
docs/
├── README.md            <- this file
├── agents/              # Skill conventions: issue tracker, triage labels, domain docs
├── adr/                 # Architecture decision records (created lazily)
├── context.md           # Project/architecture overview (verify claims against code)
├── external-resources/  # Vendored third-party docs+source (GITIGNORED)
├── grilling/            # Decision logs (Q&A) per feature, dated
├── plans/               # Execution plans per feature, dated
└── specs/               # Stable scoping specs per feature, dated
```

Related files outside `docs/`:

- `CONTEXT.md` (repo root) — ubiquitous language. Glossary only.
- `TODO.md` (repo root) — thin mirror of epics + open gaps.
- `.scratch/<feature>/` — staged issue bodies and working files (gitignored).
- GitHub Issues — authoritative tracker (`docs/agents/issue-tracker.md`).

## How work flows

1. **Grill** — interview decisions into `docs/grilling/YYYY-MM-DD-<feature>-decisions.md`.
2. **Spec** — synthesize into `docs/specs/YYYY-MM-DD-<feature>-design.md`, publish to
   GitHub Issues with `ready-for-agent`.
3. **Plan + tickets** — break the spec into `docs/plans/YYYY-MM-DD-<feature>-plan.md`
   with phased ticket tables and blocking edges; bodies staged under `.scratch/<feature>/`.

## Convention Rules

- **Glossary** (`CONTEXT.md`): terms only, no implementation. Update inline as terms resolve.
- **Specs**: stable "what and why". Implementation-free.
- **Plans**: concrete "how and in what order". Updated during execution.
- **Decision logs**: append-only Q&A records. Never edited after the fact.
- Completed/superseded documents are deleted, not archived — git history keeps them.
