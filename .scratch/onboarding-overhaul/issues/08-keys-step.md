## Parent

Part of #21

## What to build

Dedicated Keys step that appears only when the keyring is empty (`GPG_NO_KEYS`): create a key (name and email required, optional expiry, optional passphrase carried via stdin and masked) or import from file. Stream box integration with secrets hidden.

## Acceptance criteria

- [ ] Empty keyring shows dedicated Keys step; non-empty keyring skips it (key selection then lives inside store init)
- [ ] Create key form validates name/email, optional expiry, and forwards passphrase via stdin
- [ ] Stream box shows command output with `[passphrase hidden]` and never leaks the secret
- [ ] Import from file succeeds and subsequent Re-check clears `GPG_NO_KEYS`
- [ ] `mask typecheck` passes

## Blocked by

- #02, #04
