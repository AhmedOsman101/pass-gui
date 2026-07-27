# Entry Detail Secret Controls

## Goal

Harden compact secret controls in `client/src/components/EntryDetail.vue` without changing the desktop workspace layout or secret-handling behavior.

## Scope

- Keep password masked by default.
- Keep compact icon controls for close selection, reveal/hide password, copy password, and copy metadata.
- Add accessible labels to every icon control.
- Add keyboard- and pointer-accessible tooltips.
- Add a polite live status for password reveal or conceal.
- Name copied content accurately in the confirmation toast.

## Design

Each icon control remains a 32px ghost button inside the current quiet, outlined value group. Tooltips state the action before use: `Close entry`, `Show password`, `Hide password`, `Copy password`, and `Copy <metadata label>`. Accessible button names match those labels.

Password visibility remains local `shallowRef<boolean>` state. Toggling it updates a screen-reader-only polite live region: `Password shown` or `Password hidden`. The secret remains masked until the user explicitly selects Show password.

`copySecret()` keeps its current clipboard timer and Clear action. `copyValue()` receives a label and says that label was copied, instead of always saying `Password copied`.

## Boundaries

No new feature component or composable. `EntryDetail.vue` remains a single detail view; this change adds no reusable state or cross-component contract. No changes to clipboard expiry, stores, entry parsing, action hierarchy, sidebar identity, or onboarding.

## Validation

- Extend `EntryDetail.test.ts` to assert accessible labels and toggled status text.
- Run client unit tests, typecheck, and Impeccable detector for changed Vue files.
