## Parent

Part of #21

## What to build

Invalid-existing-config editor: raw TOML in an editable panel with debounced validation while typing, save enabled only when valid, plus Open in file manager and Open in default editor (`$EDITOR` then system default).

## Acceptance criteria

- [ ] Corrupted config shows editable TOML with live debounced error list
- [ ] Save is disabled while invalid and enabled when valid
- [ ] Open in file manager reveals the config file
- [ ] Open in default editor respects `$EDITOR` then system association
- [ ] `mask typecheck` passes

## Blocked by

- #05
