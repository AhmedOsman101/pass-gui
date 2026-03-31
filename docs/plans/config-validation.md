# Config Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Zod schema validation to the config system, ensuring `core.active_store` always references a valid key in `stores`.

**Architecture:** Store Zod schemas in `types/config.ts` alongside TypeScript types. Create a modular validation service in `services/config-validation.ts` with reusable validation functions. Integrate validation into `ConfigService.load()`, `ensure()`, and `save()`.

**Tech Stack:** Zod V4, lib-result, TypeScript

---

### Task 1: Add Zod schemas to types/config.ts

**Files:**
- Modify: `client/src/types/config.ts`

**Step 1: Add Zod import**

Add import at the top of `client/src/types/config.ts`:
```typescript
import { z } from "zod";
```

**Step 2: Add schemas after TypeScript types**

After line 85 (the export block), add:

```typescript
// Zod schemas for runtime validation

const CoreConfigSchema = z.object({
  active_store: z.string().min(1, "active_store cannot be empty"),
});

const PreferencesConfigSchema = z.object({
  clipboard_timeout_seconds: z.number().int().positive("clipboard_timeout_seconds must be a positive integer"),
  auto_refresh_interval_ms: z.number().int().nonnegative("auto_refresh_interval_ms must be a non-negative integer"),
});

const GenerateConfigSchema = z.object({
  default_length: z.number().int().min(8).max(128, "default_length must be between 8 and 128"),
  symbols: z.boolean(),
});

const ClipboardConfigSchema = z.object({
  clear_timeout: z.number().int().nonnegative("clear_timeout must be a non-negative number"),
});

const StoreConfigSchema = z.object({
  path: z.string().min(1, "Store path cannot be empty"),
  gnupg_home: z.string().optional(),
});

/**
 * Root app config schema with cross-field validation.
 * Uses superRefine to ensure active_store references a valid store key.
 */
const AppConfigSchema = CoreConfigSchema.extend({
  preferences: PreferencesConfigSchema,
  generate: GenerateConfigSchema,
  clipboard: ClipboardConfigSchema,
  stores: z.record(z.string(), StoreConfigSchema),
}).superRefine((val, ctx) => {
  const stores = val.stores;
  const active = val.active_store;
  
  if (!stores || typeof stores !== "object") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "stores must be an object",
      path: ["stores"],
    });
    return;
  }
  
  const storeKeys = Object.keys(stores);
  if (storeKeys.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one store must be defined",
      path: ["stores"],
    });
    return;
  }
  
  if (!storeKeys.includes(active)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid active_store '${active}'. Expected one of: ${storeKeys.join(", ")}`,
      path: ["active_store"],
    });
  }
});

export {
  CoreConfigSchema,
  PreferencesConfigSchema,
  GenerateConfigSchema,
  ClipboardConfigSchema,
  StoreConfigSchema,
  AppConfigSchema,
};
```

**Step 3: Commit**

```bash
git add client/src/types/config.ts
git commit -m "feat(config): add Zod schemas for config validation"
```

---

### Task 2: Create config validation service

**Files:**
- Create: `client/src/services/config-validation.ts`

**Step 1: Write the validation service**

Create `client/src/services/config-validation.ts`:

```typescript
import { z } from "zod";
import { Ok, Err, type Result } from "lib-result";
import type { AppConfig } from "@/types/config";
import {
  CoreConfigSchema,
  PreferencesConfigSchema,
  GenerateConfigSchema,
  ClipboardConfigSchema,
  StoreConfigSchema,
  AppConfigSchema,
} from "@/types/config";

/**
 * Result type for validation operations.
 */
type ValidationResult<T> = Result<T, z.ZodError>;

/**
 * Validates the core config section.
 */
function validateCoreConfig(core: unknown): ValidationResult<{ active_store: string }> {
  const result = CoreConfigSchema.safeParse(core);
  if (!result.success) {
    return Err(result.error);
  }
  return Ok(result.data);
}

/**
 * Validates the preferences config section.
 */
function validatePreferencesConfig(preferences: unknown): ValidationResult<{
  clipboard_timeout_seconds: number;
  auto_refresh_interval_ms: number;
}> {
  const result = PreferencesConfigSchema.safeParse(preferences);
  if (!result.success) {
    return Err(result.error);
  }
  return Ok(result.data);
}

/**
 * Validates the generate config section.
 */
function validateGenerateConfig(generate: unknown): ValidationResult<{
  default_length: number;
  symbols: boolean;
}> {
  const result = GenerateConfigSchema.safeParse(generate);
  if (!result.success) {
    return Err(result.error);
  }
  return Ok(result.data);
}

/**
 * Validates the clipboard config section.
 */
function validateClipboardConfig(clipboard: unknown): ValidationResult<{
  clear_timeout: number;
}> {
  const result = ClipboardConfigSchema.safeParse(clipboard);
  if (!result.success) {
    return Err(result.error);
  }
  return Ok(result.data);
}

/**
 * Validates the stores config section.
 */
function validateStoresConfig(stores: unknown): ValidationResult<
  Record<string, { path: string; gnupg_home?: string }>
> {
  const result = StoreConfigSchema.safeParse(stores);
  if (!result.success) {
    return Err(result.error);
  }
  return Ok(result.data);
}

/**
 * Orchestrator: validates the entire app config.
 * This is the main entry point for config validation.
 */
function validateAppConfig(config: unknown): ValidationResult<AppConfig> {
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    return Err(result.error);
  }
  return Ok(result.data);
}

/**
 * Formats a ZodError into user-friendly messages.
 */
function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join(".");
    const message = issue.message;
    return path ? `${path}: ${message}` : message;
  });
  return issues.join("\n");
}

export {
  validateCoreConfig,
  validatePreferencesConfig,
  validateGenerateConfig,
  validateClipboardConfig,
  validateStoresConfig,
  validateAppConfig,
  formatZodError,
  type ValidationResult,
};
```

**Step 2: Commit**

```bash
git add client/src/services/config-validation.ts
git commit -m "feat(config): add config validation service with modular validators"
```

---

### Task 3: Integrate validation into ConfigService

**Files:**
- Modify: `client/src/services/config.ts`

**Step 1: Add import**

Add import at the top of `client/src/services/config.ts` after existing imports:

```typescript
import { validateAppConfig, formatZodError } from "./config-validation";
```

**Step 2: Modify load() method**

Find the `load()` method (around line 53-74) and add validation after parsing:

```typescript
static async load(): Promise<Result<ParsedToml<AppConfig>>> {
  const ensureResult = await ConfigService.ensure();
  if (ensureResult.isError()) return Err(ensureResult.error);

  const configPath = await ConfigService.getPath();
  if (configPath.isError()) return Err(configPath.error);

  // Read and parse the config file
  const readResult = await fs.readFile(configPath.ok);
  if (readResult.isError()) return Err(readResult.error);

  const configResult = toml.parse<AppConfig>(readResult.ok);
  if (configResult.isError()) {
    return Err(
      new ConfigParseError(
        configResult.error,
        `Failed to parse config: ${configResult.error.message}`
      )
    );
  }

  // NEW: Validate the parsed config
  const validationResult = validateAppConfig(configResult.ok.data);
  if (validationResult.isError()) {
    return Err(
      new ConfigValidationError(
        formatZodError(validationResult.error),
        validationResult.error
      )
    );
  }

  return Ok(configResult.ok);
}
```

**Step 3: Modify ensure() method**

Find the `ensure()` method (around line 117-152) and add validation before writing default config:

```typescript
// In ensure(), after creating default config but before writing:
const validationResult = validateAppConfig(DEFAULT_CONFIG);
if (validationResult.isError()) {
  return Err(
    new ConfigValidationError(
      `Default config validation failed: ${formatZodError(validationResult.error)}`,
      validationResult.error
    )
  );
}
```

**Step 4: Modify save() method**

Find the `save()` method (around line 87-111) and add validation before writing:

```typescript
static async save(content: ParsedToml<AppConfig>): Promise<Result<void>> {
  // Ensure the config exists
  const ensureResult = await ConfigService.ensure();
  if (ensureResult.isError()) return Err(ensureResult.error);

  const configPath = await ConfigService.getPath();
  if (configPath.isError()) return Err(configPath.error);

  // NEW: Validate before saving
  const validationResult = validateAppConfig(content.data);
  if (validationResult.isError()) {
    return Err(
      new ConfigValidationError(
        formatZodError(validationResult.error),
        validationResult.error
      )
    );
  }

  // Serialize to TOML
  // ... rest of the method
}
```

**Step 5: Commit**

```bash
git add client/src/services/config.ts
git commit -m "feat(config): integrate validation into ConfigService.load, ensure, and save"
```

---

### Task 4: Update ConfigValidationError to accept ZodError

**Files:**
- Modify: `client/src/lib/errors.ts`

**Step 1: Update ConfigValidationError class**

Find the `ConfigValidationError` class (around line 160-171) and update to accept ZodError:

```typescript
class ConfigValidationError extends Error {
  public code: ConfigErrorCode;
  public type: ConfigErrorType;
  public field: string | null;
  public zodError: z.ZodError | null;

  constructor(message: string, zodError?: z.ZodError) {
    super(message);
    this.code = "CONFIG_VALIDATION_ERROR";
    this.type = CONFIG_ERROR_CODES.CONFIG_VALIDATION_ERROR;
    this.field = null;
    this.zodError = zodError ?? null;
  }
}
```

**Step 2: Add Zod import at top**

Add import after existing imports:
```typescript
import { z } from "zod";
```

**Step 3: Commit**

```bash
git add client/src/lib/errors.ts
git commit -m "feat(config): update ConfigValidationError to accept ZodError"
```

---

### Task 5: Typecheck and verify

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (no errors)

**Step 2: Run lint**

```bash
pnpm lint
```

Expected: PASS (no errors or warnings)

**Step 3: Final commit**

```bash
git add .
git commit -m "feat(config): complete config validation system"
```

---

**Plan complete!**
