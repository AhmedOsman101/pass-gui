# pass-gui

A desktop GUI for GNU Pass. It wraps `pass` and GPG behind a graphical interface and manages password stores, readiness, and entry operations.

## Language

### Readiness & onboarding

**Readiness**:
The set of checks that decide whether the app can start: required binaries present and new enough, config valid in shape and content, active store usable.
_Avoid_: dependency check, system check

**Readiness state**:
One value from the fixed state machine (`NEED_PASS`, `NEED_TREE`, `NEED_GPG`, `GPG_NO_KEYS`, `STORE_*`, `STORE_EMPTY`, `READY`) produced by evaluating readiness.
_Avoid_: error code, status

**Blocking issue**:
A readiness problem that stops startup until fixed. Non-blocking issues (like an empty store) never stop startup.
_Avoid_: error, failure

**Onboarding**:
The guided workflow that resolves every blocking issue so the app can start. It reacts to readiness states; it does not detect them.
_Avoid_: setup wizard (use only for the store sub-flow), first-run screen

**Remediation action**:
An operation the app performs to fix one blocking issue: run a command, edit `.gpg-id`, write or import config.
_Avoid_: fix, repair (as nouns)

**Guide**:
Per-platform instructions for installing or upgrading a missing or outdated binary. Distro-detected where possible; official-docs link as fallback.
_Avoid_: tutorial, help page

**Stream box**:
A collapsible terminal-like panel showing the exact command run and its live output. Secrets are masked. Reusable beyond onboarding.
_Avoid_: console, log viewer

**Re-check**:
The user-triggered re-evaluation of readiness for the current step.
_Avoid_: retry, refresh

### Config

**Config content validation**:
Semantic checks on top of schema validation — values that parse but cannot work (for example `active_store` naming no configured store). Each section is validated by the service that owns it.
_Avoid_: deep validation, semantic check

**Default config**:
The commented TOML written when no config file exists. Ships with a placeholder `default` store at `~/.password-store`.
_Avoid_: initial config, factory config

### Store

**Store**:
A pass password store directory: entries plus a `.gpg-id` file naming the recipient keys.
_Avoid_: vault, repository, safe

**Active store**:
The configured store the app currently operates on (`core.active_store`).
_Avoid_: current store, selected store

**Recipient**:
A key ID or fingerprint listed in `.gpg-id`; every entry is encrypted to all recipients.
_Avoid_: key owner, user
