# Architecture Review -- 2026-07-11

Improve-codebase-architecture skill run. 7 deepening candidates surfaced from full codebase exploration (services, stores, lib, components).

## Candidates

| #   | Candidate                                                                | Strength        | Status | Files involved                                                                                                                      | Problem                                                                                                                                   |
| --- | ------------------------------------------------------------------------ | --------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Deepen entries store** -- split 6 concerns behind one seam             | Strong          | ✅ Done | stores/entries.ts (352L), stores/clipboard.ts (114L), AppSidebar.vue, Tree.vue, EntryDetail.vue, EntryForm.vue, 7 dialog components | 32 exports spanning 6 concerns (tree, form state, clipboard buffer, skeleton UX, sort, CRUD). Interface nearly as wide as implementation. |
| 2   | **Collapse Move+Duplicate dialogs** into one parameterized module        | Strong          |        | DuplicateEntryDialog.vue (211L), MoveEntryDialog.vue (215L)                                                                         | ~190 duplicate lines between two dialogs. Bug fixes don't propagate.                                                                      |
| 3   | **Consolidate password generator** -- triplicated UI into one composable | Worth exploring |        | PasswordGenerator.vue (194L), EntryForm.vue generator panel (~70L), GenerateDialog.vue (234L)                                       | 3 components duplicating the same memorable/length/symbols/regenerate pattern. ~200 duplicate lines.                                      |
| 4   | **Push UI concerns out of stores** -- skeleton timer + toast             | Strong          |        | stores/entries.ts (skeletonTimer, showEntrySkeleton), stores/clipboard.ts (imports toast from sonner)                               | Stores managing setTimeout IDs and importing UI libraries (sonner). Testing friction.                                                     |
| 5   | **Sever lib->services dependency edge**                                  | Worth exploring | ✅ Done | lib/store-walker.ts -> imports Fs from services, lib/shell.ts -> imports Fs from services                                           | Two lib modules import from services, inverting intended layering. Pure logic and I/O coupled.                                            |
| 6   | **Collapse 14 error classes** into one generic + factory                 | Worth exploring |        | lib/errors.ts (439L, 14 classes, 6 maps)                                                                                            | ~170 lines of identical constructor boilerplate. 14 imports instead of 1.                                                                 |
| 7   | **Replace blocking module-level init promises** with lazy guards         | Worth exploring |        | services/neutralino.ts, services/gpg.ts, services/pass.ts, main.ts                                                                  | Init promises fire at import time. Failure prevents app from rendering. Known issue from CONTEXT.md (Phase 05).                           |

## Top Recommendation

**Candidate 1: Deepen the entries store.** Highest-leverage target: largest interface (32 exports), most callers (12 components), deepest concern-mixing (6 responsibilities). Every component crossing this seam pays back across every subsequent feature.

## Next Steps

- ~~Explore candidate 1 (entries store deepening) -- grilling session to design the split~~ ✅ Done
- ~~Explore candidate 5 (lib->services reversal) -- can run in parallel~~ ✅ Done

See `/tmp/architecture-review-pass-gui-20260711.html` for full visual report with before/after Mermaid diagrams.
