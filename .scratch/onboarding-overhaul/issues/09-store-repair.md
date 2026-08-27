## Parent

Part of #21

## What to build

Store repair flows for existing-store failures: `.gpg-id` missing/empty/unparseable each gets specific guidance, unknown recipient replaced with new recipient while old entries are preserved as `#`-prefixed comments, behavioral-check failures get recovery hints. Every fix ends in a passing Re-check.

## Acceptance criteria

- [ ] `.gpg-id` missing shows guidance distinct from empty vs unparseable
- [ ] Unknown recipient replace writes new recipient on line 1, old entries kept as `#` comments
- [ ] Behavioral `pass ls` failure shows actionable hint
- [ ] `mask typecheck` passes

## Blocked by

- #08
