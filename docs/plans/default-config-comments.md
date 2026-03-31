# Default Config Comments Plan

## Goal

Add explanatory TOML comments for the generated default config using `@ltd/j-toml` comment metadata APIs, only when creating a brand-new config file.

## Docs Findings

- `@ltd/j-toml` supports comment metadata with `TOML.commentFor(key)` for key/value comments and `TOML.commentForThis` for table header comments.
- Existing comments are only preserved when parsing with `x.comment: true`, which the project already enables in `client/src/lib/toml.ts`.
- Parsed tables preserve style and comment metadata through symbol keys on the raw table stored in `ParsedToml._raw`.
- Only inline comments attached directly to key/value pairs or table headers are preserved. Full-line comments and commented-out keys are not reliably preserved.
- `TOML.stringify` supports `preferCommentFor`, but that only matters if both table-level comment styles are present.

## Recommended Approach

Build the default config as a j-toml raw table with comments attached via `commentFor`/`commentForThis`, then stringify that raw table during initial config creation.

Why this approach:

- It uses the library’s intended metadata model instead of post-processing strings.
- It fits the current architecture where `ensure()` creates the initial file and `save()` round-trips `_raw`.
- It avoids rewriting existing user config files just to inject comments.

## Planned Changes

### 1. Define the target comment set

Document one concise user-facing explanation for each section and each defaulted option in `DEFAULT_CONFIG`:

- `core.active_store`
- `preferences.auto_refresh_interval_ms`
- `generation.default_length`
- `generation.symbols`
- `generation.character_set`
- `generation.character_set_no_symbols`
- `clipboard.clear_after_seconds`
- `clipboard.selection`
- `gpg.opts`
- `gpg.signing_key`
- `gpg.key`
- `extensions.enabled`
- `stores.default.path`
- `stores.default.gnupg_home`

Also decide which sections should get table-header comments:

- `core`
- `preferences`
- `generation`
- `clipboard`
- `gpg`
- `extensions`
- `stores`
- `stores.default`

### 2. Add a TOML comment-builder helper

Add a focused helper in `client/src/lib/toml.ts` or a nearby TOML-focused module that:

- converts a plain config object into j-toml `Section(...)` tables
- attaches `commentFor(key)` entries for option comments
- attaches `commentForThis` or `commentFor(section)` for section header comments
- returns a raw j-toml table compatible with the existing `stringify()` wrapper

Keep this helper specific to default-config generation instead of making the general stringify path comment-aware for all callers.

### 3. Preserve current round-trip behavior

Keep the current parse/stringify contract intact:

- `parse()` continues using `x.comment: true`
- `save(parsed)` continues serializing `parsed._raw`
- editing loaded configs still preserves previously written inline comments

No migration/backfill logic should be added for existing config files in this phase.

### 4. Integrate only in initial config creation

Update `ConfigService.ensure()` so that when no config file exists:

- the default config is still validated first
- the initial TOML content is built from the commented raw table rather than from plain `DEFAULT_CONFIG`
- existing save behavior remains unchanged for already-existing config files

This keeps comment insertion limited to first-write semantics.

### 5. Handle nested stores carefully

Because `stores.default` is nested and currently serialized as sections, verify the helper marks nested tables correctly so output remains section-based rather than collapsing into dotted keys or unexpected inline tables.

Special attention:

- root sections should still serialize as `[section]`
- nested store entries should serialize in the current readable style
- comments for nested keys must be attached to the correct table object

### 6. Update documentation

Refresh docs to describe the real limitation surface:

- default generated config includes inline option/section comments
- existing comments are preserved on round-trip when already attached to keys/tables
- full-line comments and commented-out keys are still not guaranteed to survive edits

Relevant places:

- `TODO.md`
- TOML wrapper docs/comments if needed
- optional config-format docs if they exist later

## Verification Plan

Because you asked for planning only and no tests are desired for this work, verification should focus on manual and static checks after implementation:

1. Run `pnpm typecheck`
2. Run `pnpm lint && pnpm format`
3. Manually inspect a newly generated config file to confirm:
   - section headers remain in the expected format
   - each intended option has a readable inline comment
   - comments survive a load/modify/save round-trip for edited keys
4. Manually confirm an already-existing config file is not rewritten just to add comments

## Risks / Watchouts

- `commentFor` values cannot contain newlines, so comments must stay one-line and concise.
- The project’s `extractCleanData()` intentionally strips symbol metadata from `data`; comment manipulation must happen on raw tables, not on clean data objects.
- `toSectionFormat()` currently creates plain `Section(...)` tables only; adding comments may require a second builder path instead of overloading generic stringify behavior.
- If both `commentFor('table')` and `commentForThis` are used for the same section, serialization depends on `preferCommentFor`; the implementation should standardize on one style.

## Suggested Implementation Order

1. Finalize the comment copy for every section/key.
2. Add a helper that builds a commented raw default-config table.
3. Wire that helper into `ConfigService.ensure()` for first-write only.
4. Verify section layout and comment placement with a generated TOML file.
5. Update docs about supported comment preservation behavior.
