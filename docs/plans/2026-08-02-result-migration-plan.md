# Result Migration — Plan

**Status:** Draft. Awaiting grilling confirmation before ticket creation.
**Date:** 2026-08-02
**Spec:** [`docs/specs/2026-08-02-result-migration-architecture.md`](../specs/2026-08-02-result-migration-architecture.md) — the spec (why).
**Source:** [`docs/grilling/2026-08-02-result-migration-decisions.md`](../grilling/2026-08-02-result-migration-decisions.md) — Q&A log.

---

## Hierarchy

**PR = one domain. Issue = full domain migration (composed of steps). Sub-issue = one ticket = one step = one session.**

## Ticket order

### Phase 0 — Domain-agnostic infra (3 tickets, parallel where possible)

Tickets that don't belong to any one domain. Land first so all slice tickets can use them.

| #   | Ticket                                                                                                                                                                         | Blocks                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 1   | Add `composables/use-async-action.ts` (`isLoading` + `error` refs + `run`)                                                                                                     | T6, T11, T16, T21, T22 |
| 2   | Add `composables/use-notify-result.ts` (toast wrapper, returns Result)                                                                                                         | T6, T11, T16, T21, T22 |
| 3   | Document `Pass.exec(args, { cwd, envs })` already-supported scoped-call pattern; add a smoke test asserting `PASSWORD_STORE_DIR` override flows through without `setStorePath` | T18                    |

### Phase 1 — Slice: clipboard (4 tickets, 1 PR)

Tiny surface. Sets the useAsyncAction + useNotifyResult + 5-point checklist pattern.

| #   | Ticket                                                                          | Blocks |
| --- | ------------------------------------------------------------------------------- | ------ |
| 4   | Refactor `services/clipboard.ts` — tighten signatures, ensure error classes     | T5     |
| 5   | Refactor `stores/clipboard.ts` — return Result from actions, inspect/inspectErr | T6     |
| 6   | Update clipboard consumers (components) — `useNotifyResult` + `.match()` chain  | T7     |
| 7   | Write clipboard tests (batch) — service + store, happy + failure paths          | —      |

### Phase 2 — Slice: entry-tree (5 tickets, 1 PR)

Adds rollback/optimistic update pattern. Eats the `useClipboardBuffer` composable (tree state belongs in entry-tree store).

| #   | Ticket                                                                                             | Blocks   |
| --- | -------------------------------------------------------------------------------------------------- | -------- |
| 8   | Refactor `services/entries.ts` + `services/filesystem.ts` — Result types, error classes per op     | T9, T10  |
| 9   | Refactor `stores/entry-tree.ts` — return Result, remove `try/catch`, rollback on optimistic update | T10, T11 |
| 10  | Fold `composables/use-clipboard-buffer.ts` into `stores/entry-tree.ts` — buffer is tree state      | T11      |
| 11  | Update entry-tree component consumers — call store actions, `useNotifyResult`, chain `.match()`    | T12      |
| 12  | Write entry-tree tests (batch) — including rollback path for optimistic update                     | —        |

### Phase 3 — Slice: entry-form (5 tickets, 1 PR)

Largest multi-step orchestration. Validates the rollback pattern under real complexity.

| #   | Ticket                                                                                          | Blocks   |
| --- | ----------------------------------------------------------------------------------------------- | -------- |
| 13  | Refactor `services/pass.ts` + `services/gpg.ts` — Result purity, error classes                  | T14, T15 |
| 14  | Refactor `stores/entry-form.ts` — return Result, multi-step orchestration, rollback             | T16      |
| 15  | Inspect `composables/use-password-generator.ts` — promote to store or keep as local composable  | T16      |
| 16  | Update entry-form component consumers — call store actions, `useNotifyResult`, chain `.match()` | T17      |
| 17  | Write entry-form tests (batch) — orchestration + rollback                                       | —        |

### Phase 4 — Slice: active-store (6 tickets, 1 PR)

Worst case. Removes `Pass.setStorePath` global mutation. Service owns the multi-step recipe (`mkdir` -> `pass init` -> `config write`) with internal FS rollback.

| #   | Ticket                                                                                                                                                                                            | Blocks   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 18  | Refactor `services/store.ts` — add `Store.create` + `Store.add` recipes, internal FS rollback on failure. Use `Pass.exec(args, { cwd, envs })` for scoped `pass init`, never `Pass.setStorePath`. | T19      |
| 19  | Refactor `stores/active-store.ts` — wrap recipes, state mutations + rollback                                                                                                                      | T20, T21 |
| 20  | Remove `Pass.setStorePath` from non-switcher paths; active-store switcher + startup still use it (last callers)                                                                                   | T21      |
| 21  | Refactor `AddStoreWizard.vue` — call store action, `useNotifyResult`, delete `createStore()` orchestration                                                                                        | T22      |
| 22  | Update remaining active-store consumers (SettingsPage, Switcher) — call store actions                                                                                                             | T23      |
| 23  | Write active-store tests (batch) — recipes, rollback, switcher                                                                                                                                    | —        |

## Total

- 23 tickets
- 4 PRs (one per domain)
- All domain slices can run in parallel after Phase 0 completes (independent files)
- Each slice = one Issue with N sub-issues (= tickets above)

## Tracking

Per Q15/Q27: **Issue = domain migration. Sub-issue = one ticket.**

Repo has no gh issue tracker configured (no `.opencode/tracker`). Will use local-markdown fallback per wayfinder skill: tickets live as files under `docs/plans/tickets/`, blocking edges in body via `### Blocks` / `### Blocked by` headers, frontier = unblocked tickets.

If a real tracker is configured later, tickets migrate via tracker import (ids preserved).

## Per-ticket body template

```markdown
# Ticket N: <title>

**Slice:** <domain> | **Type:** task | **Session:** 1

## Question

<what this ticket resolves — one concrete thing>

## Steps

1. ...
2. ...

## Verification

- `mask typecheck` clean
- `mask test:integration` clean (when applicable)
- 5-point checklist (for store refactors): no try/catch · returns Result · error is `Error | null` · rollback inside action · no toast/router/DOM

## Blocks

- T<N+1>
- T<N+2>

## Blocked by

- T<N-1>
```

## Done when

- All 23 tickets closed
- 4 PRs merged
- No `try/catch` outside `services/watcher.ts` subscription site
- Every store action returns `Result<T, E>`
- Test coverage: services full, stores happy+failure paths
- Wayfinder map's "Destination" satisfied (see spec)
