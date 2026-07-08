# Code Review -- 2026-07-06

Full technical review of pass-gui codebase. Excludes shadcn-vue generated components under `client/components/ui/`.

Scope: services, stores, lib, composables, components, pages, router, types, docs/plans, docs/roadmap, TODO.md.

---

## Part 1: Findings

### Bugs

1. main.ts:20-22: bug top-level `await` blocks after `app.mount()` -- if any init rejects, the app hangs on a blank screen forever with no error boundary. AGENTS.md already calls this out as a known architecture debt. This is a production risk because Neutralino init failures are silent to the user.

2. ~~services/store.ts:33-36: bug `Store.validatePath()` never checks the `isDirectory` result. If the path is a file (not a directory), it returns `Ok(undefined)` -- validation passes for non-directory paths. Every caller that relies on this to confirm a valid store directory is operating on a lie.~~ [Solved]

3. ~~stores/entries.ts:250-264: bug `pasteEntry()` always calls `selectEntry(destPath)` after paste. If the copy buffer source was a DIRECTORY, this runs `pass show <directory>` which fails with a mutation error in the UI. The source node type is never stored in the copy buffer.~~

4. ~~components/Tree.vue:155 + RenameEntryDialog.vue:81-84: bug `openRename(node.path)` does not pass `nodeType` to the rename dialog. `RenameEntryDialog` always receives `nodeType=undefined`, so `moveEntry()` always treats the renamed item as a file. After renaming a directory, `selectEntry(newPath)` fires and `pass show` on a directory path fails.~~

5. ~~services/entries.ts:91: nit `parsePassShowOutput` error is wrapped in a `MutationError` with `stdOut` as the message, leaking raw pass output into error state. Not a security leak (stdout doesn't contain secrets in error context) but bad UX.~~

### Performance / Architecture Risks

6. ~~services/pass.ts:176-182: risk `Pass.exec()` calls `Config.load()` on every single pass command execution just to read `gpg.opts`. Config is parsed from TOML + Zod-validated on every `pass show`, `pass insert`, `pass ls`, `pass rm`, `pass mv`. Under load (listing hundreds of entries), this is redundant I/O and parse overhead. Config should be cached or read once at startup.~~ [Comment: You can store a hash of the config file upon reading and check if the hash changed since last time, this caches the config until it actually changes. Make that into a utility or a service file for watching for file changes. Attach that as a hook to `Config.load` method]

7. ~~services/neutralino.ts:141-161: risk `commandExists()` checks `result.exitCode === 0` after `exec()` already throws on non-zero exit. The exitCode check is dead code -- `isOk()` already implies exitCode was 0. Not harmful but misleading to future readers.~~ [Solved]

8. ~~services/readiness.ts:295-311: risk `resolveGnupgHome()` uses a bare `catch {}` that swallows all errors silently, including unexpected failures. The intent is "config unavailable, use default" but this hides actual bugs. Should narrow the catch to specific error types or at minimum log.~~

9. services/config.ts:247-249: risk `setValue()` mutates `parsed._raw` via `as AppConfig` cast and bracket access. If the section or key doesn't exist in the raw TOML table, the assignment silently creates a dotted-key entry that j-toml may stringify differently than expected. No runtime validation after mutation. [Best to leave untouched, justify your solution first but don't execute until I approve it]

### UX Issues

10. ~~stores/entries.ts:96-98: nit `setCurrentPath()` sets `currentPath` but does not clear `currentEntry`. When clicking a directory in the tree, the old entry detail stays visible instead of showing a directory-focused or empty state. This was an intentional design decision (don't hide detail on directory click) but it creates confusion -- the entry detail shows a password for a different path than the one highlighted in the tree.~~ [That's normal, the previous behavior was more annoying to me.]

11. ~~components/AppSidebar.vue:69-94: risk Ctrl+C/X/V hotkey paste has no user feedback on failure. `pasteEntry()` sets `error.value` in the store, but the sidebar has no toast or error display. Silent failures are worse than no hotkey.~~ [Use toasts if you need to.]

12. ~~components/Tree.vue:218-246: nit `<style>` block in Tree.vue is unscoped. The `copy-pulse`, `cut-dimmed`, and `tree-node-*` classes are global. If another component uses these class names, they'll collide. Should use scoped styles or CSS modules.~~ [If they are not used anywhere else then that's fine, scoped styles create slight overhead]

### Dead Code / Cleanup

13. ~~pages/test.vue:1-30: bug dead test page. `Promise.all([ ])` does nothing. This route shows a blank page with "Test Page" heading. Should be deleted.~~ [It's a testing playground, I will add it to .gitignore but don't delete it.]

14. ~~services/entries.ts:142-143: nit `charset` variable is computed but the branching logic for `symbols` is handled locally, then `generate()` also passes through `pass generate -p`. The `pass generate` command itself supports `-s` for symbols. The current approach generates locally and pipes, which works but bypasses pass's own generation. Not a bug, but worth documenting the design choice.~~ [Solved]

15. ~~EntryDetail.vue:199: nit `entries.currentPath!` uses non-null assertion. Guarded by `v-if` in template but the assertion is a code smell. Extract to a local computed for safety.~~

### Docs / Planning Issues

16. ~~docs/plans/release-phase.md:133-136: risk release-phase.md has a section that says "Phase 04: Planned -> Done" but Phase 04 UI is NOT done (app shell, passwords page, settings page are still pending per `2026-07-02-frontend-ui-remaining.md`). This creates a false impression of completion.~~

17. ~~docs/plans/2026-07-02-frontend-ui-remaining.md:89: nit lists `index.vue` as an "old auto-router artifact" to delete, but `index.vue` is currently the main (and only) functional page with the sidebar layout. Deleting it would break the app. The plan conflates the old `index.vue` with the current one.~~

18. ~~TODO.md + docs/plans/\*.md: risk throughout the docs, raw Unicode characters are used extensively (checkmarks, arrows, emojis). User explicitly requested "Don't use unicode characters, either use ascii or icons (lucide icons), never raw unicode characters." This preference applies to all new edits but existing content was not sanitized.~~

19. AGENTS.md:165: nit `ConfigService` is referenced but the actual class is `Config` (in `config.ts`). Minor naming inconsistency.

20. docs/roadmap/README.md: risk doc structure table references plan files by path. If files are renamed or moved, links break. Currently accurate but fragile.

### Security

No plaintext password leaks found. Passwords are masked in UI (`***`), clipboard has timed clear, shell injection is mitigated via quoting/validation, path traversal is blocked by `validatePath`/`checkSneakyPath`.

21. One note: `Entries.show()` returns `raw: stdout` in `EntryDetail`. This raw output includes the password on line 1. The `raw` field is stored in `currentEntry.raw` (Pinia state). In production with Vue devtools, this is visible. Not a runtime leak but a devtools exposure.

---

## Part 2: Solutions

Done

---

## Severity Summary

| Severity | Count | Items                                                                                              |
| -------- | ----- | -------------------------------------------------------------------------------------------------- |
| Bug      | 5     | main.ts init hang, Store.validatePath, paste directory select, rename nodeType, test.vue           |
| Risk     | 5     | Pass.exec config reload, dead code in commandExists, readiness catch, config mutation, release doc |
| Nit      | 5     | error message leak, unscoped styles, non-null assertion, charset docs, naming                      |
| UX       | 2     | directory click keeps old entry, paste no feedback                                                 |
