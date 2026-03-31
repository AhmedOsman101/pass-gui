# Spec: config-validation

Scope: repo

# Config Validation Spec

## Overview

Zod-based runtime validation for the application configuration system. Ensures config integrity with user-friendly error messages.

## Requirements

1. **Schema Location**: Zod schemas defined in `types/config.ts` alongside TypeScript types
2. **Modular Validation**: Separate validation functions per config section for maintainability
3. **Cross-field Validation**: `core.active_store` must reference a valid key in `stores`
4. **Error Messages**: User-friendly, displayable directly in UI
5. **Integration**: Validation runs in `ConfigService.load()`, `ensure()`, and `save()`

## Schema Structure

| Schema | File | Purpose |
|--------|------|---------|
| CoreConfigSchema | types/config.ts | Validates core section |
| PreferencesConfigSchema | types/config.ts | Validates preferences section |
| GenerateConfigSchema | types/config.ts | Validates generate section |
| ClipboardConfigSchema | types/config.ts | Validates clipboard section |
| StoreConfigSchema | types/config.ts | Validates individual store |
| AppConfigSchema | types/config.ts | Root schema with superRefine |

## Validation Service

**File**: `services/config-validation.ts`

**Functions**:
- `validateCoreConfig(core)` → Result
- `validatePreferencesConfig(prefs)` → Result
- `validateGenerateConfig(gen)` → Result
- `validateClipboardConfig(clip)` → Result
- `validateStoresConfig(stores)` → Result
- `validateAppConfig(config)` → Result (orchestrator)
- `formatZodError(error)` → string

## Integration Points

| Method | Validation Point |
|--------|------------------|
| ConfigService.load() | After TOML parse, before returning |
| ConfigService.ensure() | Before writing default config |
| ConfigService.save() | Before serializing to TOML |

## Error Handling

- Returns `ConfigValidationError` with formatted message
- Message format: `"path.to.field: message"` (one per line)
- Cross-validation errors: `"Invalid active_store 'X'. Expected one of: A, B, C"`

## Dependencies

- zod: ^4.3.6 (already installed)
- lib-result (already installed)