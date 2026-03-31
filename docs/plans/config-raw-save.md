---
plan name: config-raw-save
plan description: Fix config save to use _raw
plan status: active
---

## Idea
Fix ConfigService to use ParsedToml._raw when saving to preserve comments and key order

## Implementation
- Add private static cache for ParsedToml<AppConfig> in ConfigService
- Update load() to cache the ParsedToml result
- Create internal saveParsedToml() that accepts ParsedToml and uses _raw for stringifying
- Update all public setValue/setStore/etc methods to use cached ParsedToml
- Handle edge case: what to do on first load (no cached data)
- Verify typecheck and lint pass

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->