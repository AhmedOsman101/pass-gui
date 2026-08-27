## Parent

Part of #21

## What to build

Config content validation on top of schema validation: orchestrator calls per-section validators owned by their services. V1 checks: `active_store` resolvable to a configured store, store path non-empty, `gnupg_home` exists when set. Errors surface in the wizard's error list.

## Acceptance criteria

- [ ] Schema-valid config with `active_store` naming no store shows a content error naming valid choices
- [ ] Config with `gnupg_home` pointing at a missing path surfaces a warning/error
- [ ] Content errors appear in the same list as schema errors
- [ ] `mask typecheck` passes

## Blocked by

- #05
