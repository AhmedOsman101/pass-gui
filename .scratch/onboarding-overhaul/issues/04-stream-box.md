## Parent

Part of #21

## What to build

Reusable Stream box component and dual execution helper: quick commands via plain exec, long-running commands via Neutralino streaming with live `stdOut`/`stdErr`. Box is collapsed by default, expandable, and masks secrets (`[passphrase hidden]`). Demonstrated on the dev test page.

## Acceptance criteria

- [ ] Stream box shows exact command line plus live chunked output for a long operation
- [ ] Quick command path works without streaming overhead
- [ ] Secrets passed via stdin never appear in the box or command line
- [ ] Component is reusable outside onboarding (ready for future View-menu use)
- [ ] `mask typecheck` passes

## Blocked by

None — can start immediately.
