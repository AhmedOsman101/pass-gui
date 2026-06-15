---
plan name: review-fixes
plan description: quality issues cleanup
plan status: active
---

## Idea
Address the remaining issues identified by code review after the roadmap/path refactor, with emphasis on correctness, error-type accuracy, dependency hygiene, and alignment with the project's Result-based backend-first architecture. The plan should reflect the current code state, meaning it should not include already-fixed items like StoreService.validatePath. It should focus on replacing the wrong file-write error type, deciding and standardizing home-directory resolution error handling in lib/path.ts and NeutralinoService initialization, removing fragile binary-resolution logic, tightening store typing/mutation, and cleaning smaller architectural inconsistencies only if they still matter after the correctness issues are fixed.

## Implementation
- Re-review the current filesystem, path, neutralino, and store service code and convert the code-review findings into an up-to-date checklist so only still-open issues are included in the implementation scope.
- Introduce a correct file-write-specific error type in client/src/lib/errors.ts and update client/src/services/filesystem.ts so file write failures no longer use DirectoryCreationError.
- Resolve the home-directory API contract by choosing a single Result-based pattern for lib/path.ts and NeutralinoService initialization, then update call sites so home resolution no longer relies on thrown async errors.
- Replace fragile command-resolution behavior in client/src/services/neutralino.ts by simplifying commandExists and using a more robust path-resolution strategy instead of parsing ls -l output for symlink handling.
- Tighten store and service correctness by removing unsafe mutation/type-assertion patterns in client/src/services/store.ts and reviewing whether the lowercase fs class or overly broad exports still need cleanup after the higher-priority fixes.
- Verify the final result with pnpm typecheck and pnpm lint && pnpm format, then update any affected docs or notes only if behavior or contracts changed.

## Required Specs
<!-- SPECS_START -->
- backend-readiness
<!-- SPECS_END -->