<script setup lang="ts">
import { RefreshCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";

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
      <button
        id="pg-memorable"
        type="button"
        role="switch"
        :aria-checked="genState.options.memorable"
        class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        :class="genState.options.memorable ? 'bg-primary' : 'bg-input'"
        @click="genState.options.memorable = !genState.options.memorable"
      >
        <span
          class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
          :class="genState.options.memorable ? 'translate-x-4' : 'translate-x-0'"
        />
      </button>
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
          max="64"
          class="flex-1"
        />
        <input
          v-model.number="genState.options.length"
          type="number"
          min="8"
          max="64"
          class="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm text-center font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>
    </div>

    <div v-if="!genState.options.memorable" class="flex items-center justify-between">
      <label for="pg-symbols" class="text-sm font-medium">
        Symbols
      </label>
      <button
        id="pg-symbols"
        type="button"
        role="switch"
        :aria-checked="genState.options.symbols"
        class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        :class="genState.options.symbols ? 'bg-primary' : 'bg-input'"
        @click="genState.options.symbols = !genState.options.symbols"
      >
        <span
          class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
          :class="genState.options.symbols ? 'translate-x-4' : 'translate-x-0'"
        />
      </button>
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
