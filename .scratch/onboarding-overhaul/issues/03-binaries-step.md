## Parent

Part of #21

## What to build

Binaries step that shows a Guide for each missing or outdated required binary (`pass`, `gpg`, `tree`). Port distro detection from `~/scripts/get-package-manager` (`/etc/os-release` `ID` then `ID_LIKE` fallback) into a pure function covering apt/nala, dnf/yum, zypper, pacman (with paru/yay notes), xbps, apk, emerge; brew for macOS and docs link for Windows or unknown distros. Guides carry install and upgrade variants, copy buttons and official-docs links. Each step has a Re-check.

## Acceptance criteria

- [ ] With `pass` hidden, guide shows correct command for detected distro family (verified on at least apt and pacman, plus unknown-distro fallback link)
- [ ] `PASS_VERSION_TOO_OLD` and `GPG_VERSION_TOO_OLD` show upgrade variant of same guide component
- [ ] macOS shows brew command plus docs link; Windows shows docs link only
- [ ] Re-check button re-evaluates and clears the step when binary appears
- [ ] `mask typecheck` passes

## Blocked by

- #02
