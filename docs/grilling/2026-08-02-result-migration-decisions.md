# Result Migration — Grilling Decisions Log

**Status:** Active grilling. Closed once `docs/specs/2026-08-02-result-migration-architecture.md` and `docs/plans/2026-08-02-result-migration-plan.md` confirmed.
**Date:** 2026-08-02
**Skill:** `grill-me`

---

## Scope

Frontend code (including stores) violates the 4-layer guide. Components/pages do too much, repetitive code in the wrong layer. Goal: apply guide across codebase.

## Decided answers

| #   | Question                             | Answer                                                                                                                                                    |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | Use-case location                    | **C** — Service owns recipe, store wraps for state mutation, component calls store                                                                        |
| 3   | Migration strategy                   | **A** — Vertical slice per domain                                                                                                                         |
| 4   | Error model per service              | **B** — One error class per op, unioned: `Result<T, FooError \| BarError \| Error>`                                                                       |
| 5   | Backward compat during migration     | **B** — Per domain atomic PR, no coexisting signatures                                                                                                    |
| 6   | Sync validation ownership            | **A** — Component-local `computed`. zod overkill for regex + uniqueness                                                                                   |
| 7   | First domain slice                   | **B** — Clipboard (tiny, fast win)                                                                                                                        |
| 8   | `Pass.setStorePath` global mutation  | **B** — `Pass.exec(cmd, { cwd, env })` overload, no global mutation. Neutralino API supports it.                                                          |
| 9   | Clipboard slice shape                | **A** — Service primitives + store owns buffer policy + composable deleted                                                                                |
| 10  | Toast policy                         | **B** — `useNotifyResult(result, opts)` composable wraps `.match()` + sonner                                                                              |
| 11  | Test policy per layer                | **A** — Services full, stores happy+failure path with `@pinia/testing`, components zero. Write tests after implementation, not per-PR.                    |
| 12  | Plan document shape                  | **C** — One plan doc, decisions inline as numbered list. Promote to ADR only if revisited. `YYYY-m-d-plan-name.md` naming.                                |
| 13  | Slice ticket layout                  | **B** — Free-form per slice (sometimes one ticket, sometimes split). Tickets grouped under one spec/plan. See `to-tickets` skill.                         |
| 14  | Doc during grilling                  | **B** — Decisions log written during grilling, plan proper at end                                                                                         |
| 15  | Plan layout (local-markdown tracker) | **B** — `docs/specs/...` + `docs/plans/...` per repo convention. Wayfinder content format.                                                                |
| 16  | Spec/Plan split                      | **A** — Spec = what we decided, Plan = ordered tickets with blocking edges                                                                                |
| 17  | Wayfinder destination                | **B** — All four domains migrated, no `try/catch` outside service boundaries, tests per layer                                                             |
| 18  | Live grilling log location           | **C** — New `docs/grilling/` folder for active logs (specs/plans stay finalized)                                                                          |
| 19  | Domain ordering                      | **A** — clipboard -> entry-tree -> entry-form -> active-store (risk curve rising)                                                                         |
| 20  | Layer order within slice             | **C** — Both ends meet: agree component + service signatures first, store fills middle                                                                    |
| 21  | Error class hierarchy                | **A** — One class per service, no shared base. `ErrFromObject` never used.                                                                                |
| 22  | Pass service global state            | **A** — Add `Pass.exec(cmd, { cwd, env })` overload now. `setStorePath` stays for switcher + startup. Remove when slice 4 migrates active-store switcher. |
| 23  | `notifyResult` design                | **A** — One function, returns Result so caller chains `.match()` for local UI                                                                             |
| 24  | Watcher & event services             | **C** — Keep throw/reject API. One `try/catch` at subscription site, logged exception to the rule                                                         |
| 25  | Rollback ownership                   | **C** — Hybrid: idempotent cleanups in service (fs), state mutations in store                                                                             |
| 26  | Existing composables                 | **B** — Evaluate per composable. `use-tree-state`/`use-generation-config` likely promote. `use-password-generator` inspect during slice 3.                  |
| 27  | Slice ticket granularity             | **PR = one domain. Issue = full domain migration. Sub-issue = one ticket = one step = one session.**                                                      |
| 28  | Store refactor template              | **A+C mix** — Minimal template + 5-point checklist as source of truth                                                                                     |
| 29  | Cross-cutting infra in slice 1       | **First tickets** — domain-agnostic infra (`useAsyncAction`, `useNotifyResult`, `Pass.exec` overload) before any domain ticket                            |
| 30  | Out of scope probes                  | **A** — Explicit list: component-level tests, `services/dialog.ts`, `services/store-walker.ts`, `lib/errors.ts` refactor                                  |

## Open questions

None. Ready to write spec + plan.

## Raw Q&A (for reference, may compress later)

### Q2 — Use-case location

Asked: "Where does `Store.create` recipe live?" Picked **C**: service owns recipe, store wraps for state, component calls store. Rationale: service is pure + testable (mkdir -> pass init -> config write), store handles rollback + state mutation, component renders + toasts.

### Q3 — Migration strategy

Asked: "Vertical slice / bottom-up / outside-in?" Picked **A** vertical slice per domain. Bottom-up stalls (services correct but no caller cares). Outside-in drags cross-cutting concerns one component at a time = drift.

### Q4 — Error model per service

Picked **B** per-op error class. Matches guide's `ApiError` example (per-service class, per-op `statusCode`). Type-safe without discriminator union invention. `ErrFromObject` only for structured fields like `{ code, field }` for validation.

### Q5 — Backward compat

Picked **B** atomic domain PRs. Coexisting signatures invite drift. Bigger PRs but no half-states.

### Q6 — Sync validation ownership

User override: **A** component-local computed. zod for one regex is YAGNI. Service trusts caller, validation never crosses layers.

### Q7 — First domain slice

Picked **B** clipboard. User: "take things easy, reconsider if plan doesn't work." Worst component (AddStoreWizard) is too risky as first template. Tiny slice exposes composable/store promotion pattern without complexity overload.

### Q8 — Pass.setStorePath global mutation

User: Neutralino `exec` supports `cwd`, `env`, `stdin`, background. Picked **B** `Pass.exec(cmd, { cwd, env })` scoped, no global mutation.

### Q9 — Clipboard slice shape

Picked **A** keep split: service primitives, store owns buffer policy, composable deleted. Guide: shared state = store. Buffer is used everywhere = store territory.

### Q10 — Toast policy

Picked **B** `useNotifyResult(result, { ok?, err? })` composable. Toast = cross-cutting UI concern, lives in `composables/use-notify-result.ts`. Component still `.match()`s for local concerns (close modal, focus).

### Q11 — Test policy

Picked **A** services full + stores happy/failure with `@pinia/testing`. Components zero (visual review). User added: **write all tests at end of implementation, not per-PR.**

### Q12 — Plan document shape

Picked **C** one plan doc, inline numbered decisions. Naming: `YYYY-m-d-plan-name.md`. ADRs only if decision is revisited.

### Q13 — Slice ticket layout

Picked **B** free-form. Each slice = one ticket group. Sometimes big (active-store), sometimes split.

### Q14 — Doc during grilling

Picked **B** decisions log during grilling, plan at end. Grilling skill: "do not enact until I confirm."

### Q15 — Plan layout

Picked **B** `docs/specs/` + `docs/plans/` per repo convention. Follow wayfinder content format.

### Q16 — Spec/Plan split

Picked **A** spec = what (decisions log), plan = how (tickets + edges). Existing convention: specs are design docs, plans are executable.

### Q17 — Wayfinder destination

Picked **B** concrete: 4 domains migrated, no `try/catch` outside service boundary, tests per layer. Avoids metric-only (C) or vague (A) framings.

### Q18 — Grilling log location

Picked **C** new `docs/grilling/` folder. Active grilling is own artifact type, like `code-reviews/`, `roadmap/`.

### Q19 — Domain ordering

Picked **A** clipboard -> entry-tree -> entry-form -> active-store. Each slice compounds the pattern from previous. Order = risk curve rising.

### Q20 — Layer order within slice

Picked **C** both ends meet. Component + service signatures agreed first (typing handshake), store fills middle. Locks contract before either end fills in.

### Q21 — Error class hierarchy

Picked **A** one class per service, no shared base. User: "Don't use ErrFromObject ever. Always use error classes with `Err` or normal `Error` class using `ErrFromText`."

### Q22 — Pass service global state

Picked **A** but user clarified API is already there: `Pass.exec(args, options)` already accepts `ExecCommandOptions` (`cwd`, `envs`, `stdIn`, `background`) and passes through to `Neu.exec`. No new overload needed. `setStorePath` stays for active-store switcher + startup. Recipe callers use `Pass.exec(args, { cwd: path, envs: { PASSWORD_STORE_DIR: path } })` to scope without mutating global.

### Q23 — notifyResult design

Picked **A** one function, returns Result. Caller chains `.match()` for local UI.

### Q24 — Watcher & event services

Picked **C** keep throw/reject API. Documented exception to rule. One `try/catch` at subscription site, logs + re-subscribes.

### Q25 — Rollback ownership

Picked **C** hybrid. Service undoes filesystem mess (rmdir on init fail). Store undoes state mess (remove from config). Neither knows other.

### Q26 — Existing composables

Picked **B** evaluate per composable. Inspect in slice tickets, not now.

### Q27 — Slice ticket granularity

User clarified: **PR = one domain. Issue = full domain migration (composed of steps). Sub-issue = one ticket = one step = one session.**

### Q28 — Store refactor template

Picked **A+C mix**. Minimal template + 5-point checklist.

### Q29 — Cross-cutting infra

Picked "first". Domain-agnostic infra before any domain ticket.

### Q30 — Out of scope probes

Picked **A** explicit list to prevent mid-migration drift.
