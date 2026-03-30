import { Err, Ok, type Result } from "lib-result";
import { z } from "zod";
import type {
  AppConfig,
  ClipboardConfig,
  CoreConfig,
  GenerateConfig,
  PreferencesConfig,
} from "@/types/config";

// Zod schemas for config validation
const CoreConfigSchema = z.object({
  active_store: z.string().min(1, "active_store cannot be empty"),
});

const PreferencesConfigSchema = z.object({
  clipboard_timeout_seconds: z
    .number()
    .int()
    .positive("clipboard_timeout_seconds must be a positive integer"),
  auto_refresh_interval_ms: z
    .number()
    .int()
    .nonnegative("auto_refresh_interval_ms must be a non-negative integer"),
});

const GenerateConfigSchema = z.object({
  default_length: z
    .number()
    .int()
    .min(8)
    .max(128, "default_length must be between 8 and 128"),
  symbols: z.boolean(),
});

const ClipboardConfigSchema = z.object({
  clear_timeout: z
    .number()
    .int()
    .nonnegative("clear_timeout must be a non-negative number"),
});

const StoreConfigSchema = z.object({
  path: z.string().min(1, "Store path cannot be empty"),
  gnupg_home: z.string().optional(),
});

/**
 * Root app config schema with cross-field validation.
 * Uses superRefine to ensure active_store references a valid store key.
 */
const AppConfigSchema = z
  .object({
    core: CoreConfigSchema,
    preferences: PreferencesConfigSchema,
    generate: GenerateConfigSchema,
    clipboard: ClipboardConfigSchema,
    stores: z.record(z.string(), StoreConfigSchema),
  })
  .superRefine((val, ctx) => {
    const stores = val.stores;
    const active = val.core.active_store;

    if (!stores || typeof stores !== "object") {
      ctx.addIssue({
        code: "custom",
        message: "stores section must be defined",
        path: ["stores"],
      });
      return;
    }

    const storeKeys = Object.keys(stores);
    if (storeKeys.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "At least one store must be defined",
        path: ["stores"],
      });
      return;
    }

    if (!storeKeys.includes(active)) {
      ctx.addIssue({
        code: "custom",
        message: `Invalid active_store '${active}'. Expected one of: ${storeKeys.join(", ")}`,
        path: ["core", "active_store"],
      });
    }
  });

/**
 * Result type for validation operations.
 */
type ValidationResult<T> = Result<T, z.ZodError>;

/**
 * Validates the core config section.
 */
function validateCoreConfig(core: unknown): ValidationResult<CoreConfig> {
  const result = CoreConfigSchema.safeParse(core);
  if (!result.success) return Err(result.error);

  return Ok(result.data);
}

/**
 * Validates the preferences config section.
 */
function validatePreferencesConfig(
  preferences: unknown
): ValidationResult<PreferencesConfig> {
  const result = PreferencesConfigSchema.safeParse(preferences);
  if (!result.success) return Err(result.error);
  return Ok(result.data);
}

/**
 * Validates the generate config section.
 */
function validateGenerateConfig(
  generate: unknown
): ValidationResult<GenerateConfig> {
  const result = GenerateConfigSchema.safeParse(generate);
  if (!result.success) return Err(result.error);
  return Ok(result.data);
}

/**
 * Validates the clipboard config section.
 */
function validateClipboardConfig(
  clipboard: unknown
): ValidationResult<ClipboardConfig> {
  const result = ClipboardConfigSchema.safeParse(clipboard);
  if (!result.success) return Err(result.error);
  return Ok(result.data);
}

/**
 * Orchestrator: validates the entire app config.
 * This is the main entry point for config validation.
 */
function validateAppConfig(config: unknown): ValidationResult<AppConfig> {
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) return Err(result.error);
  return Ok(result.data);
}

/**
 * Formats a ZodError into user-friendly messages.
 */
function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map(issue => {
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
  validateAppConfig,
  formatZodError,
  type ValidationResult,
};
