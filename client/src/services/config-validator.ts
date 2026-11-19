import Path from "@/lib/path";
import toml from "@/lib/toml";
import type { AppConfig } from "@/types/config";
import { formatZodError, validateAppConfig } from "./config-validation";
import { Fs } from "./filesystem";

/**
 * Combined result of validating a config: the schema layer plus the
 * content (semantic) checks layered on top of it.
 *
 * - `schemaValid` mirrors the Zod schema layer. When it is false the
 *   content checks cannot run, so `contentValid` is `null` (unknown).
 * - `contentValid` is false only when a blocking content issue exists
 *   (an active store with a broken GNUPGHOME). Inactive-store issues are
 *   warnings and leave it true.
 * - `errors` and `warnings` are already split into display lines; both
 *   schema and content findings land in `errors` so the wizard can show
 *   one list.
 */
type ConfigValidationOutcome = {
  schemaValid: boolean;
  contentValid: boolean | null;
  errors: string[];
  warnings: string[];
};

/**
 * Splits a newline-joined diagnostic message into individual lines.
 */
function splitLines(message: string): string[] {
  return message
    .split("\n")
    .map(line => line.trim())
    .filter(line => line !== "");
}

/**
 * Probes a single GNUPGHOME path. Returns a reason string when the path
 * cannot be used as a directory, or null when it is usable. Filesystem
 * failures are reported as reasons — never silently treated as valid.
 */
async function probeGnupgHome(home: string): Promise<string | null> {
  const resolved = await Path.resolveUserPath(home);
  if (resolved.isError()) {
    return `could not be resolved (${resolved.error.message})`;
  }

  const isDir = await Fs.isDirectory(resolved.ok);
  if (isDir.isError()) {
    return `could not be checked (${isDir.error.message})`;
  }
  if (!isDir.ok) return "is not an existing directory";

  return null;
}

/**
 * Config content validation: semantic checks that run only on a
 * schema-valid config. `active_store` resolution and non-empty store
 * paths are already enforced by the schema layer; the only V1 content
 * check is that each configured GNUPGHOME points at a directory.
 *
 * The active store's problem blocks; every inactive store's problem is
 * reported as a warning so it stays visible without blocking startup.
 */
async function validateContent(
  config: AppConfig
): Promise<Pick<ConfigValidationOutcome, "errors" | "warnings">> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const activeStore = config.core.active_store;

  for (const [name, store] of Object.entries(config.stores)) {
    const home = store.gnupg_home;
    if (!home) continue;

    const reason = await probeGnupgHome(home);
    if (reason === null) continue;

    const message = `Store '${name}': GNUPGHOME '${home}' ${reason}.`;
    if (name === activeStore) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  return { errors, warnings };
}

/**
 * Orchestrates config validation end to end: schema first, then content
 * checks on the parsed config. Owned here (not by `Config`) so no import
 * cycle is introduced and `Config.load/save/importText` stay schema-only.
 */
class ConfigValidator {
  static async validate(config: unknown): Promise<ConfigValidationOutcome> {
    const schema = validateAppConfig(config);
    if (schema.isError()) {
      return {
        schemaValid: false,
        contentValid: null,
        errors: splitLines(formatZodError(schema.error)),
        warnings: [],
      };
    }

    const { errors, warnings } = await validateContent(schema.ok);
    return {
      schemaValid: true,
      contentValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Text-level entry point: parse TOML, then run the full schema + content
   * validation on the result. Parse failures come back as blocking errors
   * in the same outcome shape, so callers holding raw text (the editor)
   * and callers holding an already-read file (the wizard) share one seam
   * and cannot disagree about what counts as valid.
   */
  static async validateText(rawText: string): Promise<ConfigValidationOutcome> {
    const parsed = toml.parse<AppConfig>(rawText);
    if (parsed.isError()) {
      return {
        schemaValid: false,
        contentValid: null,
        errors: [`Could not parse the config: ${parsed.error.message}`],
        warnings: [],
      };
    }

    return await ConfigValidator.validate(parsed.ok.data);
  }
}

export type { ConfigValidationOutcome };
export { ConfigValidator };
