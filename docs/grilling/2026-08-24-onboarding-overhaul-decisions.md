# Onboarding Overhaul — Grilling Decisions Log

**Date:** 2026-08-24
**Status:** In progress
**Outcome:** Will produce spec + plan + tickets under `docs/specs/`, `docs/plans/`.

---

## Facts established from codebase (Round 0)

- `Readiness` service (`client/src/services/readiness.ts`) is an 11-state
  detection machine: `NEED_PASS → NEED_TREE → NEED_GPG → GPG_NO_KEYS →
  STORE_NOT_FOUND → STORE_NO_GPG_ID → STORE_GPG_ID_EMPTY →
  STORE_GPG_ID_KEY_MISSING → STORE_SCAN_FAILED → STORE_EMPTY → READY`.
  Sequential checks: pass (+version ≥1.7) → tree → gpg → secret keys →
  store dir → `.gpg-id` parse → recipient verification → behavioral
  `pass ls` → empty-store check.
- `BlockedScreen.vue` is the current dead-end: one `IssueCard`
  (code → generic text + URL) + retry that only re-polls the store.
- `AddStoreWizard.vue` (Settings) already does name → path → GPG key
  selection with existing-store detection. Reuse candidate.
- `Store.create()` recipe exists: mkdir → scoped `pass init` → config write.
- `Config.ensure()` writes commented `DEFAULT_CONFIG` on first run.
  `DEFAULT_CONFIG` ships a placeholder `default` store at
  `~/.password-store`, so a fresh config passes schema validation.
- Known issue (context.md): module-level init promises in `main.ts`
  (`neuInitialized`, `gpgInitialized`, `passInitialized`) block mount
  before `ReadinessGate` renders. If init fails hard, no UI ever shows.
- Windows: `tree` check skipped; Gpg4win paths known.
- Neutralino `os.spawnProcess` streams `stdOut`/`stdErr` events per chunk
  (confirmed in `neutralino-cpp/api/os/os.cpp`) and accepts `stdIn`.
  Live streaming terminal box is feasible; stdin can carry passphrases.
- `~/scripts/get-package-manager` detects distro families via
  `/etc/os-release` (`ID`, fallback `ID_LIKE`): apt/nala, dnf, yum,
  zypper, pacman/paru/yay, xbps, apk, emerge. Output `pkgManager:installCmd`.

## Steps the user forgot about (answered)

Beyond the user's listed steps, detection also covers:
1. Binary version checks (pass ≥1.7, GPG ≥2.1 → "too old" states).
2. Global GPG-no-keys state (checked before store validation).
3. Behavioral check (`pass ls` must succeed against the store).
4. Empty-store info state (non-blocking).

---

## Round 1 decisions

| #   | Question                    | Decision                                                                                                                                                     |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Detection vs remediation    | Keep `Readiness` as detector. Onboarding reacts to its snapshots. No rewrite of detection logic.                                                              |
| Q2  | Fresh-install config        | Do not silently create. Tell user no config found; offer default or import (file picker or paste). Variant B (create then offer import/next) acceptable if simpler. |
| Q3  | Content validation          | Cheap set only: active_store resolvable, store path non-empty, gnupg_home exists-if-set. Zod covers shape/bounds. Future: choices presented as actual choices. |
| Q4  | Remediation execution       | App executes commands in-app. Terminal-like box with toggle streams command + live output. Clone-existing-store route: show commands only; git out of scope V1. |
| Q5  | Install guides              | Per-distro-family instructions using get-package-manager logic. Unknown distro → official docs link. macOS: brew + docs link. Windows: docs link only (future work). |
| Q6  | Wizard shape                | Full-screen stepper replacing BlockedScreen + "Run setup again" entry in Settings.                                                                            |
| Q7  | Init blocking fix           | In scope as Phase 0. Make service init lazy/failable so the gate always renders.                                                                              |
| Q8  | JSON schema                 | Future work, not in this effort.                                                                                                                              |
| Q9  | Resume mechanics            | Re-check button on every step.                                                                                                                                |

## Round 2 decisions

| #    | Question                  | Decision                                                                                                                                                          |
| ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q10  | Fresh-install config      | Variant A: ask first ("Use default" / "Import existing"). Nothing written until user chooses. Import accepts file picker or pasted TOML.                           |
| Q11  | Stream box                | Tactical: quick commands use plain exec; long-running commands stream via `spawnProcess`. Stream box is a reusable component. Future work (documented): Application Menu Bar with View-menu toggle showing output for ALL app commands, not just onboarding. |
| Q12  | Key generation            | Name + email required, optional expiry, optional passphrase. Passphrase via stdin (`--passphrase-fd 0`), masked input, `[passphrase hidden]` in stream box. Empty passphrase allowed. |
| Q13  | `.gpg-id` rewrite         | Confirmed: new key ID line 1, old entries preserved below prefixed with `#`.                                                                                       |
| Q14  | Empty store end           | Option A: drop into main app. Onboarding fixes readiness only; sidebar handles empty tree.                                                                         |
| Q15  | Wizard placement          | Own route `/onboarding`. Gate redirects when blocked; Settings links to same route.                                                                                |
| Q16  | Version-too-old guides    | Same distro-guide component, upgrade-command variant.                                                                                                              |
| Q17  | Keys step                 | Dedicated Keys step only when keyring empty (`GPG_NO_KEYS`). Otherwise key selection lives inside store-init flow (AddStoreWizard pattern).                        |

## Future work register (documented, not in V1)

1. JSON schema for config (+ schema-driven form editing).
2. Application Menu Bar; View-menu toggle to show command output for all
   app commands via the reusable stream box.
3. Windows binary guides (research needed).
4. Clone-existing-store route (git integration).
5. Deeper content-validation choices presented as explicit choices.

## Round 3 decisions

| #    | Question                     | Decision                                                                                                                                              |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q18  | Fixing invalid config        | Option B: in-app editable TOML panel. Validation runs debounced while typing; save refused unless valid. Also: "Open in file manager" and "Open in default editor" (`$EDITOR` env var, else system default app). |
| Q19  | Broken store + alternatives  | Offer to FIX the active store first; only after that offer switching to another configured store or creating a new one.                                |

**Outcome:** Spec published as GitHub issue [#21](https://github.com/AhmedOsman101/pass-gui/issues/21), label `ready-for-agent`. Plan + tickets follow.

## Round 4 decisions (T4 session — binaries step, issue #25)

| #   | Question                  | Decision                                                                                                                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q20 | Distro parsing source     | Port `~/scripts/get-package-manager` **1:1** into `lib/distro.ts`: exact `ID` list, legacy `VERSION_ID` branches (centos 7*/amzn 2 → yum), `opensuse*` glob, then `ID_LIKE` tokens in the script's order. `~/scripts/get-distro`'s `PRETTY_NAME` shows in the step header. Pure text-in/family-out. |
| Q21 | Install command shapes    | Commands keep the script's execution-ready shapes: `sudo -A`, `--noconfirm` on pacman, yum without sudo on legacy rpm; nala/paru/yay surface as alternatives (install variant only). Package atoms per distro (openSUSE `password-store`, Fedora/rpm `gnupg2`, gentoo atoms). Homebrew is valid on Linux too (user correction): unknown-Linux guides fall back to the brew command instead of docs-only, and known Linux families list `brew install/upgrade` as an extra alternative; Windows stays docs-only. |
| Q22 | Running commands in-app   | Offer **Run for me**: spawn through the stream box (Q4 machinery). In-app sudo has no TTY, hence `sudo -A`: resolve `SUDO_ASKPASS` per `~/scripts/get-askpass` semantics — pre-set env honored, else a wrapper (zenity → kdialog → yad, absolute paths) written + chmod'd into the data dir; terminal helpers dropped (no TTY in the app window). Exit 0 auto-triggers Re-check. Note: Neutralino's `envs` option replaces the child environment (no PATH), so the export must ride inside the `sh -c` payload. |
| Q23 | Command picker (pnpm-io inspiration) | Auto-detection stays the **default** selection (we're a local wizard, not a docs site — no OS-tab matrix). The three override cases are all handled: detection failed (unknown → chip row of brew + every family), detection wrong, preference mismatch (nala/paru/yay/brew). "Alternatives" are promoted from dead text to **selectable command chips** inside `BinaryGuide.vue`: selection, copy target, note and the emitted run command travel together; DIY (copy via terminal / docs link) stays a choice, never a forced fallback. Re-check never resets a mid-step choice. |

## Round 5 (Q24) — service restructure

`lib/binary-guides.ts` started as a pure table but grew feature behavior (candidate composition, readiness-issue mapping, display copy). User rule: **when a feature outgrows a lib, it becomes a service.** Moved to `services/guides.ts` (class `Guides`, static methods: `forBinary`, `issueEntries`, `familyLabel`, `chipLabel`, `versionLabel`; `BinaryIssueEntry` type lives in `types/guide.ts`). `lib/distro.ts` stays a lib — still pure text-in/family-out. `services/askpass.ts` was already a service.

## Round 6 (Q25–Q29) — human review corrections on the #25 diff

| # | Topic | Decision |
| --- | --- | --- |
| Q25 | Pre-set `SUDO_ASKPASS` | Blindly honoring the env var was half a solution: a helper that needs a TTY hangs inside the app window. Validate against `~/scripts/get-askpass`'s helper zoo — TTY-only helpers (whiptail, dialog, stty content sniff) and stale paths are skipped, the app's GUI chain takes over; unrecognized helpers get a **runtime dialog** (use yours / use pass-gui's), remembered per session. zip GUI-known helpers (zenity/kdialog/yad/ssh-askpass/x11-ssh-askpass) are honored without asking. |
| Q26 | chmod in the wrapper | Claim "Neutralino has no chmod API" was wrong — the filesystem API gained chmod/chown in v6.9.0. `Fs.chmod` replaces the shell-out. |
| Q27 | Clipboard naming | Persistent write is the **default**: `Clipboard.writeText` (no config, no timer) and store `copy`; the timed secret write is explicit — `Clipboard.writeWithTimeout` / store `copyWithTimeout`. |
| Q28 | `DistroOs` type | Duplicate of `OperatingSystem` from `@neutralinojs/lib` — reuse the enum, drop the alias. String literals at call sites must use the enum members. |
| Q29 | String style | No hand-broken string literals: one line per string; the formatter owns wrapping. Only multiline *text* splits and comments may wrap. |

## Late corrections (post-Round 3)

- **No test infrastructure exists.** Verified: zero test files, no runner
  config. Earlier docs claimed 583 tests — stale. Spec verification is
  manual (`mask typecheck` + scripted walkthroughs). Seams S1–S4 chosen
  so a future suite attaches without refactoring.
- **Repo docs cleaned:** `docs/review|code-reviews/` batches deleted
  (finished result-migration artifacts), empty `docs/tickets/` removed,
  `docs/context.md` rewritten from verified codebase facts, `TODO.md`
  trimmed to real open gaps, `docs/README.md` matches actual layout.
- **Tracker setup:** `docs/agents/{issue-tracker,triage-labels,domain}.md`
  written; `AGENTS.md` gained the Agent skills block; labels
  `needs-triage`, `needs-info`, `ready-for-human`, `wayfinder:prototype`
  created on GitHub. Root `CONTEXT.md` glossary seeded.

## Glossary additions (staged, merge into docs/context.md on landing)

- **Onboarding** — the guided workflow that resolves every blocking
  readiness state so the app can start. Replaces BlockedScreen.
- **Remediation action** — an in-app operation (exec command, file edit,
  config write) that fixes one blocking issue.
- **Stream box** — collapsible terminal-like panel that shows the exact
  command run and its live stdout/stderr. Secrets are masked.
- **Guide** — per-platform instructions for installing or upgrading a
  missing/outdated binary. Distro-detected where possible.
