# P0 Pure Lib Tests — Implementation Plan

## Context

Continuing from parse-pass-show.test.ts (already done, committed, 15/15 passing).
3 remaining P0 test files to implement, then verify.

## Tasks

### Task 1: generate-password.test.ts

- **Source:** client/src/lib/generate-password.ts (85 lines)
- **File:** client/src/lib/generate-password.test.ts
- **Dependencies:** `crypto.getRandomValues` — must stub with `vi.stubGlobal("crypto", { getRandomValues: vi.fn() })`
- **Exported functions to test:**
  - `generatePassword(length, charset)` — expands POSIX brackets, generates random chars
  - `generateMemorablePassword()` — generates `NNNN-word-word-word` format
- **Edge cases:** password length, charset expansion ([[:punct:]], [[:alnum:]], etc.), memorable format structure

### Task 2: tree-index.test.ts

- **Source:** client/src/lib/tree-index.ts (30 lines)
- **File:** client/src/lib/tree-index.test.ts
- **Pure function:** `buildIndex(tree)` builds `{ byPath, parent, children }` maps from EntryTree
- **Types:** EntryNode, EntryTree, TreeIndex from `@/types/entries`
- **Edge cases:** flat list, nested dirs, empty tree, single node, root children mapping

### Task 3: tree-state.test.ts

- **Source:** client/src/lib/tree-state.ts (162 lines)
- **File:** client/src/lib/tree-state.test.ts
- **Exported functions:**
  - `buildVisible(index, expandedDirs, sortMode?)` — flattened visible tree
  - `buildSearchResults(index, query)` — search with parent inclusion
  - `expandSet(expandedDirs, path)` / `collapseSet(index, expandedDirs, path)` / `toggleSet(index, expandedDirs, path)`
  - `sortPaths(index, paths, sortMode?)` — sort with dirs first, alphabetical/reverse
- **Edge cases:** sort order (alphabetical, reverse, dirs first), visible tree from index with various expansion states, expand/collapse recursion (collapse removes children), search filtering with parent inclusion, empty states

## Global Constraints

- TDD: Red-Green for each test function
- Co-locate test files next to source (e.g., `generate-password.test.ts` next to `generate-password.ts`)
- Use Vitest built-in assertions (not @testing-library/vue for pure functions)
- No imports from @neutralinojs/lib needed — these are pure lib functions
- For crypto-dependent tests (generate-password.ts), use `vi.stubGlobal` / `vi.unstubGlobal`
- Types are imported from `@/types/entries`
- `buildIndex` returns `TreeIndex = { byPath: Map<string, EntryNode>, parent: Map<string, string | null>, children: Map<string, string[]> }`
- Test output must be pristine (no warnings, no noise)
- Run `pnpm test` before committing
