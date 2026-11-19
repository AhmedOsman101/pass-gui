## Parent

Part of #21. Bug found during manual Void Linux VM walkthrough of the binaries step.

## What to build

Fix the in-app `sudo -A` remediation path:

1. **Only offer "Run for me" when a system askpass helper is available.** Detect helper availability on mount (per OS, no side effects). With no helper, do not render the Run button or the stream-box workflow — leave the plain-`sudo` command visible/copyable and show a short note that a helper must be installed to run commands in-app. No dead-end clicks.
2. **Cross-platform helper chain.** Linux: pre-set `SUDO_ASKPASS` → zenity → kdialog → yad → ssh-askpass → x11-ssh-askpass. macOS: pre-set → `/usr/bin/osascript` with AppleScript `display dialog … default answer "" with hidden answer` → ssh-askpass. Windows: no chain (docs-only flows). Any helper that prints the password to stdout and exits 0 is valid.
3. **No in-app password prompt.** Explicitly rejected as a security risk — collecting the password in our own UI and echoing it to a helper has the same weakness as the "simple AppleScript" approach. System helpers only; if none exists, the user runs the copied plain command in a terminal.
4. **Persistent failure feedback for runtime errors.** If a detected helper disappears or `Neu.spawn` fails after the click, show a persistent inline error in `BinariesStep` and log via `Logger.error` with the reason. Currently only a transient toast fires and `Askpass.ensure()` logs nothing.
5. **Plain `sudo` for humans.** `BinaryGuide.vue` displays and copies the `sudo …` command without `-A`; `-A` stays internal to the runner. Remove the "drop -A by hand" note in `BinariesStep.vue`.
6. **Latent fix**: `askpass.ts:107` uses `getEnv("DISPLAY") ?? getEnv("WAYLAND_DISPLAY")`; `getEnv` returns `""`, never `null`, so Wayland-only sessions are falsely rejected. Use an empty-string-aware check.

## Acceptance criteria

- [ ] With no askpass helper installed, "Run for me" is not shown; the plain-sudo copy remains available
- [ ] Linux helper order includes zenity/kdialog/yad/ssh-askpass/x11-ssh-askpass; macOS tries osascript before ssh-askpass
- [ ] No in-app password prompt is introduced
- [ ] Runtime askpass/spawn failures produce a persistent inline error and a `Logger.error` line
- [ ] Displayed and copied commands use plain `sudo`, never `sudo -A`
- [ ] Wayland-only session no longer reports "no graphical session"
- [ ] `mask typecheck` passes
- [ ] Human review approval before commit/close (the #27/#28 senior-reviewer delegation does NOT apply here)
