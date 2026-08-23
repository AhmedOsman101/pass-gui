<script setup lang="ts">
import { RefreshCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface GeneratorState {
  options: { memorable: boolean; length: number; symbols: boolean };
  generated: string;
}

const genState = defineModel<GeneratorState>("genState", { required: true });
const emit = defineEmits<{ regenerate: [] }>();

// Whether the generated value is displayed inside this panel. The standalone
// dialog needs it; the inline form panel does not (the form field shows it).
const props = withDefaults(defineProps<{ showValue?: boolean }>(), {
  showValue: true,
});
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="props.showValue"
      class="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2"
    >
      <code class="flex-1 text-sm font-mono break-all select-all">
        {{ genState.generated || "—" }}
      </code>
    </div>

    <div class="flex items-center justify-between">
      <label for="pg-memorable" class="text-sm font-medium">
        Memorable
      </label>
      <Switch id="pg-memorable" v-model="genState.options.memorable" />
    </div>

    <div v-if="!genState.options.memorable" class="space-y-2">
      <label for="pg-length" class="text-sm font-medium">
        Length
      </label>
      <div class="flex items-center gap-3">
        <input
          id="pg-length"
          v-model.number="genState.options.length"
          type="range"
          min="8"
          max="128"
          class="flex-1"
        />
        <input
          v-model.number="genState.options.length"
          type="number"
          min="8"
          max="128"
          class="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>
    </div>

    <div v-if="!genState.options.memorable" class="flex items-center justify-between">
      <label for="pg-symbols" class="text-sm font-medium">
        Symbols
      </label>
      <Switch id="pg-symbols" v-model="genState.options.symbols" />
    </div>

    <p v-if="genState.options.memorable" class="text-xs text-muted-foreground">
      Format: NNNN-word-word-word (4 digits + 3 EFF words)
    </p>

    <Button variant="outline" class="w-full" @click="emit('regenerate')">
      <RefreshCw class="size-4 mr-2" />
      Regenerate
    </Button>
  </div>
</template>
