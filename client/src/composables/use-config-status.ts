import { type Ref, ref } from "vue";
import { Logger } from "@/lib/logger";
import toml from "@/lib/toml";
import { Config } from "@/services/config";
import { validateAppConfig } from "@/services/config-validation";
import { Fs } from "@/services/filesystem";
import type { AppConfig } from "@/types/config";
import type { ConfigStatus } from "@/types/onboarding";

type UseConfigStatusReturn = {
  status: Ref<ConfigStatus>;
  refresh: () => Promise<void>;
};

const MISSING: ConfigStatus = {
  exists: false,
  schemaValid: false,
  contentValid: null,
};

/**
 * Real ConfigStatus for onboarding, shared by the step machine and the
 * Config step. `contentValid` stays null until Config content validation
 * lands; the step machine treats null as "unknown, not blocking".
 */
function useConfigStatus(): UseConfigStatusReturn {
  const status = ref<ConfigStatus>({ ...MISSING });

  async function refresh(): Promise<void> {
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
      status.value = { exists: true, schemaValid: false, contentValid: null };
      return;
    }

    const readResult = await Fs.readFile(pathResult.ok);
    if (readResult.isError()) {
      await Logger.error(
        `useConfigStatus.refresh(): ${readResult.error.message}`
      );
      status.value = { exists: true, schemaValid: false, contentValid: null };
      return;
    }

    const parsed = toml.parse<AppConfig>(readResult.ok);
    if (parsed.isError()) {
      await Logger.error(`useConfigStatus.refresh(): ${parsed.error.message}`);
      status.value = { exists: true, schemaValid: false, contentValid: null };
      return;
    }

    const validationResult = validateAppConfig(parsed.ok.data);
    status.value = {
      exists: true,
      schemaValid: validationResult.isOk(),
      contentValid: null,
    };
  }

  return { status, refresh };
}

export type { UseConfigStatusReturn };
export { useConfigStatus };
