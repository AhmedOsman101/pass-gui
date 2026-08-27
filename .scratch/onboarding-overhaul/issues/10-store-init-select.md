## Parent

Part of #21

## What to build

Store init or select flows: initialize a new store with a chosen key (existing recipe) or point at an existing directory with detection, plus fix-first policy — when the active store is broken but other configured stores are healthy, repair is offered first and switching or creating a new store comes after.

## Acceptance criteria

- [ ] Missing/empty store offers init new vs point at existing path with detection
- [ ] New-store init creates directory, runs scoped `pass init`, writes config and passes Re-check
- [ ] Fix-first: broken active store shows repair primary, switch or create secondary
- [ ] `mask typecheck` passes

## Blocked by

- #08
