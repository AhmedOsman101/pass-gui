# pass-gui TODO

Authoritative work tracking happens in **GitHub Issues**
(`docs/agents/issue-tracker.md`). This file only mirrors the current
epics and the small open gaps that have no issue yet.

## In progress

- [ ] **Onboarding overhaul** — guided remediation workflow replacing
      BlockedScreen: binary guides per distro, config create/import/edit,
      key creation/import, store repair. Spec: issue **#21**
      (`ready-for-agent`). Includes Phase 0 fix for module-level init
      blocking.

## Open gaps (no issue yet — file one before starting)

- [ ] Per-session store override (§2)
- [ ] Store rename / safe removal in Settings (§6.3)
- [ ] Multi-recipient `.gpg-id` authoring (add-store wizard picks one key)
- [ ] Command execution timeouts (§7)
- [ ] Watch store directory for external changes -> tree refresh (§5)
- [ ] Migrate runtime preferences into config `preferences` section (§13)
- [ ] GPG agent handling + passphrase prompts via agent (§9)
- [ ] Secret-safe logging audit; developer debug mode (§12)
- [ ] SearchBar polish: clear button + result count (§10)

## Future / parked

- Windows install guides for onboarding (research needed; docs link only
  until then) — tracked as follow-up of #21
- JSON schema for config (+ schema-driven editing) — follow-up of #21
- Application Menu Bar with View-menu command-output viewer — follow-up
  of #21
- Clone existing store over git — follow-up of #21
- QR code export for passwords
- pass extensions support (`.extensions` detection + execution, OTP)
