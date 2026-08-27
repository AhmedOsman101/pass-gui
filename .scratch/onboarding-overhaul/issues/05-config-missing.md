## Parent

Part of #21

## What to build

Missing-config branch of the Config step: when no config file exists, ask first — offer to create the Default config or import an existing one via file picker or pasted TOML. Imports validate before any write and failures show the error list beside an example Default config. Nothing is written until the user chooses.

## Acceptance criteria

- [ ] Deleting config shows choice: Use default vs Import existing
- [ ] Import via file picker validates before write; invalid import shows errors plus example config
- [ ] Import via pasted TOML behaves the same
- [ ] Use default writes the commented Default config and advances
- [ ] `mask typecheck` passes

## Blocked by

- #02
