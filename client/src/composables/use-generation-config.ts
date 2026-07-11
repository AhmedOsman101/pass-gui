import { reactive } from "vue";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { Config } from "@/services/config";

export function useGenerationConfig() {
  const options = reactive({
    memorable: DEFAULT_CONFIG.generation.memorable,
    length: DEFAULT_CONFIG.generation.default_length,
    symbols: DEFAULT_CONFIG.generation.symbols,
  });

  void (async () => {
    const [memorableResult, lengthResult, symbolsResult] = await Promise.all([
      Config.getValue("generation", "memorable"),
      Config.getValue("generation", "default_length"),
      Config.getValue("generation", "symbols"),
    ]);

    if (!memorableResult.isError()) options.memorable = memorableResult.ok;
    if (!lengthResult.isError()) options.length = lengthResult.ok;
    if (!symbolsResult.isError()) options.symbols = symbolsResult.ok;
  })();

  return { options };
}
