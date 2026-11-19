import { type Ref, ref } from "vue";
import { Logger } from "@/lib/logger";
import toml from "@/lib/toml";
import { Config } from "@/services/config";
import { ConfigValidator } from "@/services/config-validator";
import { Fs } from "@/services/filesystem";
import type { AppConfig } from "@/types/config";
import type { ConfigStatus } from "@/types/onboarding";

type UseConfigStatusReturn = {
  status: Ref<ConfigStatus>;
  errors: Ref<string[]>;
  warnings: Ref<string[]>;
  refresh: () => Promise<void>;
};

const MISSING: ConfigStatus = {
  exists: false,
  schemaValid: false,
  contentValid: null,
};

/**
 * Real ConfigStatus for onboarding, shared by the step machine and the
 * Config step. Schema and content checks are produced in one validation
 * pass by `ConfigValidator`; `errors`/`warnings` carry the display lines
 * for the wizard's single issue list.
 */
function useConfigStatus(): UseConfigStatusReturn {
  const status = ref<ConfigStatus>({ ...MISSING });
  const errors = ref<string[]>([]);
  const warnings = ref<string[]>([]);

  async function refresh(): Promise<void> {
    // Clear stale diagnostics on every pass — a fixed config must not
    // keep showing the errors from the previous read.
    errors.value = [];
    warnings.value = [];

    const existsResult = await Config.exists();
    if (existsResult.isError()) {
      await Logger.error(
        `useConfigStatus.refresh(): ${existsResult.error.message}`
      );
      // Fail closed: an unreadable existence check must never resolve the
      // config step. Every write is fail-closed too, so no data can be lost.
      status.value = { ...MISSING };
      return;
    }
    if (!existsResult.ok) {
      status.value = { ...MISSING };
      return;
    }

    const pathResult = await Config.getPath();
    if (pathResult.isError()) {
      await Logger.error(
        `useConfigStatus.refresh(): ${pathResult.error.message}`
      );
      errors.value = [
        `Could not locate the config path: ${pathResult.error.message}`,
      ];
      status.value = { exists: true, schemaValid: false, contentValid: null };
      return;
    }

    const readResult = await Fs.readFile(pathResult.ok);
    if (readResult.isError()) {
      await Logger.error(
        `useConfigStatus.refresh(): ${readResult.error.message}`
      );
      errors.value = [`Could not read the config: ${readResult.error.message}`];
      status.value = { exists: true, schemaValid: false, contentValid: null };
      return;
    }

    const parsed = toml.parse<AppConfig>(readResult.ok);
    if (parsed.isError()) {
      await Logger.error(`useConfigStatus.refresh(): ${parsed.error.message}`);
      errors.value = [`Could not parse the config: ${parsed.error.message}`];
      status.value = { exists: true, schemaValid: false, contentValid: null };
      return;
    }

    const outcome = await ConfigValidator.validate(parsed.ok.data);
    status.value = {
      exists: true,
      schemaValid: outcome.schemaValid,
      contentValid: outcome.contentValid,
    };
    errors.value = outcome.errors;
    warnings.value = outcome.warnings;
  }

  return { status, errors, warnings, refresh };
}

export type { UseConfigStatusReturn };
export { useConfigStatus };
