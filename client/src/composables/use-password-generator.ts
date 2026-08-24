import { reactive, watchEffect } from "vue";
import { useGenerationConfig } from "@/composables/use-generation-config";
import {
  generateMemorablePassword,
  generatePassword,
} from "@/lib/generate-password";

export function usePasswordGenerator() {
  const genOptions = useGenerationConfig();

  const state = reactive({
    options: genOptions.options,
    generated: "",
    regenerate: (): void => {
      const {
        memorable,
        length,
        symbols,
        charsetSymbols,
        charsetNoSymbols,
      } = state.options;
      state.generated = memorable
        ? generateMemorablePassword()
        : generatePassword(length, symbols ? charsetSymbols : charsetNoSymbols);
    },
  });

  watchEffect(() => {
    state.regenerate();
  });

  return state;
}
