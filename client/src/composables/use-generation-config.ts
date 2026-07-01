import { ref } from "vue";
import { Config } from "@/services/config";

/**
 * Loads generation config from disk and applies values to reactive refs.
 * Call `load()` when the dialog/form opens to get fresh config.
 */
export function useGenerationConfig() {
  const memorable = ref(false);
  const length = ref(25);
  const symbols = ref(true);

  async function load(): Promise<void> {
    const [memorableResult, lengthResult, symbolsResult] = await Promise.all([
      Config.getValue("generation", "memorable"),
      Config.getValue("generation", "default_length"),
      Config.getValue("generation", "symbols"),
    ]);

    if (!memorableResult.isError()) memorable.value = memorableResult.ok;
    if (!lengthResult.isError()) length.value = lengthResult.ok;
    if (!symbolsResult.isError()) symbols.value = symbolsResult.ok;
  }

  return { memorable, length, symbols, load };
}
