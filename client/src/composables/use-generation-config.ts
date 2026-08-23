import { reactive } from "vue";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { Config } from "@/services/config";

export function useGenerationConfig() {
  const options = reactive({
    memorable: DEFAULT_CONFIG.generation.memorable,
    length: DEFAULT_CONFIG.generation.default_length,
    symbols: DEFAULT_CONFIG.generation.symbols,
  });

  void (async () => {
    const result = await Config.load();
    if (result.isError()) {
      await Logger.warn(
        `useGenerationConfig: config unavailable, using defaults: ${result.error.message}`
      );
      return;
    }
    // Schema validation guarantees every field exists on the section.
    const generation = result.ok.data.generation;
    options.memorable = generation.memorable;
    options.length = generation.default_length;
    options.symbols = generation.symbols;
  })();

  return { options };
}
