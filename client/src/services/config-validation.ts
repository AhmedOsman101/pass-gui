import { Err, Ok, type Result } from "lib-result";
import { z } from "zod";
import type {
  AppConfig,
  ClipboardConfig,
  CoreConfig,
  ExtensionsConfig,
  GenerationConfig,
  GpgConfig,
  PreferencesConfig,
  StoreConfig,
} from "@/types/config";

// Zod schemas for config validation
const CoreConfigSchema = z.object({
  active_store: z.string().min(1, "active_store cannot be empty"),
});

const PreferencesConfigSchema = z.object({
  auto_refresh_interval_ms: z
    .number()
    .int()
    .nonnegative("auto_refresh_interval_ms must be a non-negative integer"),
});

const GenerationConfigSchema = z.object({
  memorable: z.boolean(),
  default_length: z
    .number()
    .int()
    .min(8)
    .max(128, "default_length must be between 8 and 128"),
  symbols: z.boolean(),
  character_set: z.string().min(1, "character_set cannot be empty"),
  character_set_no_symbols: z
    .string()
    .min(1, "character_set_no_symbols cannot be empty"),
});

const ClipboardConfigSchema = z.object({
  clear_after_seconds: z
    .number()
    .int()
    .nonnegative("clear_after_seconds must be a non-negative number"),
  selection: z.enum(["clipboard", "primary", "secondary"], {
    message: "selection must be one of: clipboard, primary, secondary",
  }),
});

const GpgConfigSchema = z.object({
  opts: z.array(z.string().min(1, "gpg.opts entries cannot be empty")),
  signing_key: z.string().min(1, "signing_key cannot be empty").optional(),
  key: z.string().min(1, "key cannot be empty").optional(),
});

const ExtensionsConfigSchema = z.object({
  enabled: z.boolean(),
});

const StoreConfigSchema = z.object({
  path: z.string().min(1, "Store path cannot be empty"),
  gnupg_home: z.string().optional(),
});

const StoresConfigSchema = z.record(z.string(), StoreConfigSchema);

/**
 * Root app config schema with cross-field validation.
 * Uses superRefine to ensure active_store references a valid store key.
 */
const AppConfigSchema = z
  .object({
    core: CoreConfigSchema,
    preferences: PreferencesConfigSchema,
    generation: GenerationConfigSchema,
    clipboard: ClipboardConfigSchema,
    gpg: GpgConfigSchema,
    extensions: ExtensionsConfigSchema,
    stores: StoresConfigSchema,
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
 * Validates the generation config section.
 */
function validateGenerationConfig(
  generation: unknown
): ValidationResult<GenerationConfig> {
  const result = GenerationConfigSchema.safeParse(generation);
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
 * Validates the gpg config section.
 */
function validateGpgConfig(gpg: unknown): ValidationResult<GpgConfig> {
  const result = GpgConfigSchema.safeParse(gpg);
  if (!result.success) return Err(result.error);
  return Ok(result.data);
}

/**
 * Validates the extensions config section.
 */
function validateExtensionsConfig(
  extensions: unknown
): ValidationResult<ExtensionsConfig> {
  const result = ExtensionsConfigSchema.safeParse(extensions);
  if (!result.success) return Err(result.error);
  return Ok(result.data);
}

/**
 * Validates the stores config section.
 */
function validateStoresConfig(
  stores: unknown
): ValidationResult<Record<string, StoreConfig>> {
  const result = StoresConfigSchema.safeParse(stores);
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
  formatZodError,
  type ValidationResult,
  validateAppConfig,
  validateClipboardConfig,
  validateCoreConfig,
  validateExtensionsConfig,
  validateGenerationConfig,
  validateGpgConfig,
  validatePreferencesConfig,
  validateStoresConfig,
};
