<script lang="ts" setup>
import { RefreshCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface GeneratorState {
  options: { memorable: boolean; length: number; symbols: boolean };
  generated: string;
}

const genState = defineModel<GeneratorState>("genState", { required: true });

// Whether the generated value is displayed inside this panel. The standalone
// dialog needs it; the inline form panel does not (the form field shows it).
const props = withDefaults(defineProps<{ showValue?: boolean }>(), {
  showValue: true,
});
const emit = defineEmits<{ regenerate: [] }>();
</script>

<template>
  <div class="space-y-4">
    <div
      class="border-input bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2"
      v-if="props.showValue"
    >
      <code class="flex-1 font-mono text-sm break-all select-all">
        {{ genState.generated || "—" }}
      </code>
    </div>

    <div class="flex items-center justify-between">
      <label class="text-sm font-medium" for="pg-memorable"> Memorable </label>
      <Switch id="pg-memorable" v-model="genState.options.memorable" />
    </div>

    <div class="space-y-2" v-if="!genState.options.memorable">
      <label class="text-sm font-medium" for="pg-length"> Length </label>
      <div class="flex items-center gap-3">
        <input
          class="flex-1"
          id="pg-length"
          max="128"
          min="8"
          type="range"
          v-model.number="genState.options.length"
        >
        <input
          class="border-input bg-background ring-offset-background focus:ring-ring w-16 rounded-md border px-2 py-1 text-center font-mono text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
          max="128"
          min="8"
          type="number"
          v-model.number="genState.options.length"
        >
      </div>
    </div>

    <div
      class="flex items-center justify-between"
      v-if="!genState.options.memorable"
    >
      <label class="text-sm font-medium" for="pg-symbols"> Symbols </label>
      <Switch id="pg-symbols" v-model="genState.options.symbols" />
    </div>

    <p class="text-muted-foreground text-xs" v-if="genState.options.memorable">
      Format: NNNN-word-word-word (4 digits + 3 EFF words)
    </p>

    <Button class="w-full" variant="outline" @click="emit('regenerate')">
      <RefreshCw class="mr-2 size-4" />
      Regenerate
    </Button>
  </div>
</template>
