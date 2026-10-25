## Parent

Part of #21

## What to build

Binaries step that shows a Guide for each missing or outdated required binary (`pass`, `gpg`, `tree`). Port distro detection from `/etc/os-release` (`ID` then `ID_LIKE` fallback) into a pure function covering apt/nala, dnf/yum, zypper, pacman (with paru/yay notes), xbps, apk, emerge; brew for macOS and docs link for Windows or unknown distros. Guides carry install and upgrade variants, copy buttons and official-docs links. Each step has a Re-check.

Scope added during implementation (user, T4 session): the step also offers **Run for me** for the shown install/upgrade commands — app-executed remediation per decision Q4, streamed into the stream box (ticket #23 machinery). In-app `sudo` has no TTY, so commands keep the conventional `sudo -A` shape and the app resolves `SUDO_ASKPASS` itself — a pre-set env var is validated first (TTY-only helpers like whiptail/dialog/stty are skipped, GUI-known helpers honored, unrecognized helpers answered by a runtime dialog remembered per session), then the app writes its own zenity/kdialog/yad wrapper (chmod'd via the Neutralino filesystem API, v6.9.0). Exit 0 triggers an auto Re-check.

Scope added during review (user, T4 session, decision Q23): **Command picker** (pnpm-style). Detection stays the default selection, but the alternatives are selectable chips in each guide: a picked chip becomes the copy target *and* the Run-for-me target (covers preference mismatch — nala/paru/yay — and wrong detection). On an unknown Linux distro the chip row lists brew first, then every family. Windows stays docs-only. DIY paths (copy via terminal, docs link) remain first-class. The guide command table lives in `services/guides.ts` (class `Guides`, decision Q24: feature outgrew a lib); distro parsing stays pure in `lib/distro.ts`. Selection, copy, note and run command travel together inside `BinaryGuide.vue`; Re-check never resets a mid-step choice.

## Acceptance criteria

- [ ] With `pass` hidden, guide shows correct command for detected distro family (verified on at least apt and pacman, plus unknown-distro fallback link)
- [ ] `PASS_VERSION_TOO_OLD` and `GPG_VERSION_TOO_OLD` show upgrade variant of same guide component
- [ ] macOS shows brew command plus docs link; Windows shows docs link only
- [ ] Alternatives render as selectable chips; a picked chip updates the copy target and the Run-for-me command; unknown Linux lists brew + every family as chips
- [ ] Run for me executes the selected command (confirm dialog → stream box → toast → auto Re-check on exit 0)
- [ ] Re-check button re-evaluates and clears the step when binary appears
- [ ] `mask typecheck` passes

## Blocked by

- #02
