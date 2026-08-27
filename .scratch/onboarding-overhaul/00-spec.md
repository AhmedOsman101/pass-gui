# Spec: Onboarding overhaul

## Problem Statement

When something blocks startup, the app shows a dead end. A config error produces a vague message and a Retry button that does nothing (a full reload works better). A missing binary or an unusable store shows the same static card with a URL, and nothing else. A new user with no `pass`, no keys, and no config cannot reach the main app at all, and nothing tells them what to do for their operating system.

## Solution

A full-screen Onboarding workflow replaces the blocked screen. It reacts to the existing Readiness state machine and walks the user through, in order:

1. **Binaries** — required binaries (`pass`, `gpg`, `tree`) present and new enough. Each missing or outdated binary gets a Guide: exact install/upgrade commands for the detected distro family, brew for macOS, official-docs link for Windows and unknown distros.
2. **Config** — if no config exists: choose the Default config or import one (file picker or pasted TOML). If a config exists but is invalid: show the validation errors next to an example config, and edit the raw TOML in place. Saving is impossible until the config is valid.
3. **Keys** — only when the keyring has no secret keys: create a key (guided form) or import one.
4. **Store** — make the Active store usable: initialize a new store, point at an existing one, repair `.gpg-id`, or replace a lost key while preserving old recipients. Fixing the current store is offered before switching to another configured store or creating a new one.

Every step has a Re-check button. Every command the app runs can show its live output in a collapsible Stream box. When all blocking issues are resolved, onboarding hands over to the main app.

## User Stories

1. As a new user, I want the app to tell me exactly which required binaries are missing, so that I know what blocks startup.
2. As a new user on Ubuntu, I want a copy-pasteable `apt` install command for each missing binary, so that I can fix it without searching the web.
3. As a new user on Arch, Fedora, openSUSE, Void, Alpine, or Gentoo, I want commands for my package manager, so that the guide matches my system.
4. As a user of an unknown distro, I want a link to each project's official install docs, so that I am not stuck with wrong commands.
5. As a macOS user, I want a brew command plus an official-docs link, so that I can install the binaries my way.
6. As a Windows user, I want a link to official docs, so that I have honest guidance instead of guesses.
7. As a user with an outdated `pass` or GPG, I want upgrade commands for my distro, so that I can satisfy the minimum version.
8. As a user who installed a binary outside the app, I want a Re-check button on the binaries step, so that the app notices without a restart.
9. As a new user, I want to be told no config exists and be offered the default or an import, so that nothing is written to disk before I choose.
10. As a migrating user, I want to import a config from a file, so that I can reuse my existing setup.
11. As a migrating user, I want to paste config text directly, so that I can import from a clipboard or a chat message.
12. As a user with an invalid config, I want the validation errors listed clearly next to an example config, so that I can see what I got wrong.
13. As a user with an invalid config, I want to edit the raw TOML inside the wizard, so that I can fix it without leaving the app.
14. As a user editing the config, I want validation to run while I type (debounced), so that I get feedback without pressing anything.
15. As a user editing the config, I want saving refused while the content is invalid, so that I cannot persist a broken config.
16. As a user who prefers an external editor, I want buttons to open the config in the file manager or in my default editor, so that I can edit it my way.
17. As a new user with no GPG keys, I want one clear step to create or import a key, so that encryption can work.
18. As a user creating a key, I want to enter name, email, optional expiry, and optional passphrase, so that the key matches my needs.
19. As a security-conscious user, I want my passphrase sent through stdin and masked everywhere, so that it never appears in command output or process lists.
20. As a curious user, I want a terminal-like box showing the exact command run and its live output, so that I can trust what the app did.
21. As a user in a hurry, I want the output box collapsed by default, so that it does not clutter the wizard.
22. As a new user with no store, I want to initialize one with a chosen key, so that the store is created correctly.
23. As a migrating user with an existing store directory, I want to point the app at it and have it verified, so that I keep my passwords.
24. As a user whose `.gpg-id` lists a key I no longer have, I want to replace it with a new or imported key while old recipients stay commented in the file, so that no information is lost.
25. As a user whose `.gpg-id` is empty or unparseable, I want specific guidance per case, so that I know the difference between an empty file and a broken one.
26. As a user whose active store directory is missing, I want fixing that store offered first, so that the app does not silently abandon my configured setup.
27. As a user with several stores, I want the option to switch the active store or add a new one after the fix-first offer, so that alternatives remain one click away.
28. As a user whose store passes all checks but has no entries, I want to land in the main app, so that I can start using it immediately.
29. As a user who fixed everything, I want onboarding to close and hand me the main app, so that there is no extra ceremony.
30. As a returning user, I want "Run setup again" in Settings, so that I can re-enter onboarding deliberately.
31. As a user mid-onboarding, I want completed requirements to auto-skip, so that I never see steps I do not need.
32. As a user whose config parses but names a nonexistent active store, I want a content error naming the problem and the valid choices, so that schema-valid nonsense is still caught.
33. As a user with a custom GNUPGHOME that does not exist, I want a content warning, so that silent fallbacks do not confuse me later.

## Implementation Decisions

- **Detection stays; onboarding reacts.** The Readiness service keeps producing snapshots. Onboarding maps snapshot states to steps and remediations. Detection logic is not rewritten.
- **Unblock rendering first (Phase 0).** Module-level service init currently promises-block the app before the gate can render; any hard failure means no UI. Init becomes lazy/failable so the gate — and therefore onboarding — always renders.
- **Route-based wizard.** Onboarding lives at its own route. The readiness gate redirects there when blocked and allows that route through its own check. Settings links to the same route ("Run setup again").
- **One new seam: the step machine.** A pure module maps `(readiness snapshot, config status)` to an ordered list of steps with transition and skip rules. All wizard routing logic lives here; components stay dumb.
- **Step order:** Binaries → Config → Keys → Store → Done. The Keys step exists only when the keyring is empty; otherwise key selection happens inside store initialization (the existing add-store wizard pattern).
- **Guides are data, not prose.** Distro detection reads `/etc/os-release` (`ID`, then `ID_LIKE` fallback) and resolves a package-manager family: apt/nala, dnf/yum, zypper, pacman (with paru/yay notes), xbps, apk, emerge. The logic is ported from the maintainer's `get-package-manager` script into the app (that script lives outside the repo and cannot ship). Each guide carries install and upgrade command variants plus official-docs URLs. macOS: brew + docs. Windows: docs link only.
- **Config step asks before writing.** Missing config → choice: create Default config or import (file picker / paste). Imports are validated before any write; failures show the error list beside an example Default config.
- **Invalid-config editor.** Raw TOML in an editable panel; debounced validation while typing; save enabled only when valid; "open in file manager" and "open in default editor" (`$EDITOR`, else system default) as escape hatches.
- **Content validation is cheap and owned.** One orchestrator calls per-section validators exported by the owning services. V1 checks: `active_store` resolvable to a configured store, store path non-empty, `gnupg_home` exists when set. Zod already covers shape and bounds.
- **Key creation uses stdin for secrets.** Passphrase (optional) reaches GPG via `--passphrase-fd 0`; input is masked; the Stream box prints `[passphrase hidden]`. Name and email required; expiry optional.
- **`.gpg-id` rewrite format.** New recipient on line 1; previous entries preserved below, each prefixed with `#`.
- **Fix-first store policy.** When the active store fails, remediation for that store is offered first; switching to another healthy configured store or creating a new store comes after.
- **Two execution paths.** Quick commands use plain exec. Long-running commands use Neutralino's spawning API and stream stdout/stderr chunks into the reusable Stream box (collapsed by default). The Stream box is a shared component, ready for the future View-menu integration.
- **Completion.** No final ceremony: onboarding navigates into the main app. An empty store is a non-blocking info state the sidebar already handles.

## Testing Decisions

This repo currently has **no test infrastructure** (no test files, no runner config — stale docs claim otherwise). Nothing in this spec assumes tests exist.

Verification is manual and scripted per ticket:

- `mask typecheck` must pass.
- Each ticket ends with a short walkthrough list (exact states to force and expected UI), executed via `mask dev`.

The seams are chosen so a future suite attaches without refactoring: snapshots in (S1), a pure step machine (S2), Result-returning service remediations (S3), dumb components (S4).

## Out of Scope

- JSON schema for the config (follow-up once the shape settles).
- Application Menu Bar and the View-menu toggle exposing output for all app commands.
- Windows install-guide content (research needed; docs link only for now).
- Cloning an existing store over git (would add `git` as a required binary).
- Deeper content-validation checks beyond the V1 set.
- Bootstrapping a test suite.

## Further Notes

- Future work register (documented in the grilling log): JSON schema; Menu Bar + global command-output viewer; Windows guides; git clone route; richer content-validation choices.
- The distro-detection port should stay a pure function over os-release content so it remains trivially verifiable by inspection.
- Glossary terms for this feature (Onboarding, Remediation action, Guide, Stream box, Re-check, Blocking issue, Config content validation) are defined in the root `CONTEXT.md`.
