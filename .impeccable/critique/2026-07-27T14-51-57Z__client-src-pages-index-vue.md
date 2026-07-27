---
target: primary password-store workspace
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-07-27T14-51-57Z
slug: client-src-pages-index-vue
---
Method: dual-agent (A: ses_05bf41279fferEssTLYBxgpLmh · B: ses_05bf20ae1ffekfV7ZQ3BpF5vaY)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2 | No active store identity, store path, refresh state, or decrypt state in workspace. |
| 2 | Match System / Real World | 3 | Folder tree fits `pass`; Generate lacks outcome context. |
| 3 | User Control and Freedom | 3 | Powerful entry actions exist, but equal visual weight makes choice costly. |
| 4 | Consistency and Standards | 3 | Shared primitives exist; sidebar search bypasses shared Input and hierarchy differs by pane. |
| 5 | Error Prevention | 2 | Delete sits beside routine mutations; reveal and copy lack visible safety framing. |
| 6 | Recognition Rather Than Recall | 2 | Sensitive reveal, copy, close, and settings controls are icon-only. |
| 7 | Flexibility and Efficiency | 4 | Resizable panes, context menus, and keyboard actions strongly support expert work. |
| 8 | Aesthetic and Minimalist Design | 3 | Quiet system is coherent; five peer entry actions weaken focus. |
| 9 | Error Recovery | 2 | Clipboard expiry and Clear recovery help; failed decrypt/store/search states lack source evidence. |
| 10 | Help and Documentation | 1 | Workspace does not teach store model, local path, tree actions, or privacy behavior. |
| **Total** | | **25/40** | **Functional, but trust and action hierarchy need work.** |

## Design Specificity Verdict

The desktop two-pane workspace feels made for `pass`: filesystem tree, monospace paths, masking, clipboard expiry, and keyboard actions fit local UNIX tooling. But its critical moments remain category-interchangeable: generic masthead, generic empty state, and generic outline-button action row hide local-first trust and expert `pass` fluency.

Deterministic scan found one warning: `client/src/assets/main.css:1` imports Google Fonts Inter (`overused-font`). This aligns with the implementation, but is not a functional defect; Inter already matches the recorded system. Detector has no meaningful Vue component coverage, so it did not catch hierarchy, trust, or discoverability issues.

## Overall Impression

Calm and credible. Expert browsing is efficient. Biggest opportunity: make current-store context and sensitive actions deliberate enough for a local-first password manager.

## What's Working

- Resizable 22% / 12% navigation pane supports dense desktop store navigation without sacrificing detail space (`client/src/pages/index.vue:14-25`).
- Tree supports mouse, context menu, and keyboard navigation/actions, preserving expert `pass` workflows (`client/src/components/Tree.vue:101-120`).
- Passwords remain masked by default; copied-password toast states timed clearing and exposes immediate Clear recovery (`client/src/components/EntryDetail.vue:86-112`, `165-192`).

## Priority Issues

### [P1] Active-store trust signal missing

**Why it matters:** Users cannot verify which local store they are changing before reveal, edit, move, or delete.

**Fix:** Put active store name and compact local path/status in sidebar header. Keep path inspectable and copyable, not persistent clutter.

**Suggested command:** `$impeccable clarify client/src/components/AppSidebar.vue`

### [P1] High-risk entry actions lack hierarchy

**Why it matters:** Duplicate, Edit, Rename, Move, and Delete appear as peer decisions. Every task becomes risk assessment; Delete feels routine.

**Fix:** Keep Edit direct. Put Duplicate, Rename, Move, and Delete in labeled overflow; separate Delete with destructive treatment.

**Suggested command:** `$impeccable distill client/src/components/EntryDetail.vue`

### [P1] Sensitive icon controls lack labels

**Why it matters:** First-timers guess. Privacy-conscious users cannot confidently distinguish reveal from copy.

**Fix:** Add accessible names and tooltips to close, reveal/hide, copy, and settings. Make reveal/copy explicit in secret-value context.

**Suggested command:** `$impeccable harden client/src/components/EntryDetail.vue`

### [P2] First-run states do not teach `pass` mental model

**Why it matters:** Beginners get controls without confidence in entries, folders, GPG, or local ownership.

**Fix:** Name current local store, explain entry/folder model in one sentence, and offer Create entry plus Create folder.

**Suggested command:** `$impeccable onboard client/src/components/AppSidebar.vue`

### [P2] Search feedback incomplete

**Why it matters:** No-match, loading, and collapsed-tree states are indistinguishable.

**Fix:** Add result count, no-results state, and “Search entries” scope label.

**Suggested command:** `$impeccable clarify client/src/components/AppSidebar.vue`

## Persona Red Flags

**Power user:** Global copy/cut/paste and shortcuts are strong, but no visible store identity lets mutation happen without an immediate target-store check.

**First-timer:** New versus Generate is unclear; folder creation hides in right-click menu; search has no no-results teaching state.

**Privacy-conscious local-first user:** Reveal and copy are icon-only. Clipboard clearance reassures after copy, but active local-store identity is absent before disclosure.

## Minor Observations

- Rename `Search...` to `Search entries`.
- Label A-Z / Z-A control as sort context.
- Fold `No additional metadata` into metadata absence rather than giving it vertical weight.
- Distinguish tree search and keyboard-focus states beyond shared muted surfaces.

## Questions to Consider

- Why is exact local-store identity hidden during sensitive work?
- Should Edit remain task center while filesystem mutations move into deliberate overflow?
- Can first-run teach `pass` entry anatomy without turning workspace into a tutorial?
