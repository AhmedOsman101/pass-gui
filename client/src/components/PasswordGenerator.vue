<script setup lang="ts">
import { ref, computed } from "vue";
import { Copy, RefreshCw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  generateMemorablePassword,
  generatePassword,
} from "@/lib/generate-password";
import { useClipboardStore } from "@/stores/clipboard";

const clipboard = useClipboardStore();

const emit = defineEmits<{
  (e: "save", password: string): void;
}>();

const isOpen = ref(false);
const memorable = ref(false);
const length = ref(25);
const symbols = ref(false);
const generated = ref("");

const charset = computed(() => {
  const alpha = "[[:alnum:]]";
  return symbols.value ? `${alpha}[[:punct:]]` : alpha;
});

function generate(): void {
  generated.value = memorable.value
    ? generateMemorablePassword()
    : generatePassword(length.value, charset.value);
}

function copyToClipboard(): void {
  if (generated.value) {
    clipboard.copy(generated.value, "password-generator");
  }
}

function handleSave(): void {
  if (generated.value) {
    emit("save", generated.value);
    isOpen.value = false;
  }
}

function handleOpen(): void {
  if (!generated.value) generate();
}
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="(v) => v && handleOpen()">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Password Generator</DialogTitle>
        <DialogDescription>
          Generate a random password. Copy it wherever you need.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div
          class="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2"
        >
          <code class="flex-1 text-sm font-mono break-all select-all">
            {{ generated || "—" }}
          </code>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            :disabled="!generated"
            @click="copyToClipboard"
          >
            <Copy class="size-4" />
          </Button>
        </div>

        <div class="flex items-center justify-between">
          <label for="pg-memorable" class="text-sm font-medium">
            Memorable
          </label>
          <button
            id="pg-memorable"
            type="button"
            role="switch"
            :aria-checked="memorable"
            class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            :class="memorable ? 'bg-primary' : 'bg-input'"
            @click="memorable = !memorable"
          >
            <span
              class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
              :class="memorable ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </div>

        <div v-if="!memorable" class="space-y-2">
          <div class="flex items-center justify-between">
            <label for="pg-length" class="text-sm font-medium">
              Length: {{ length }}
            </label>
            <span class="text-xs text-muted-foreground">{{ length }}</span>
          </div>
          <input
            id="pg-length"
            v-model.number="length"
            type="range"
            min="8"
            max="64"
            class="w-full"
          />
        </div>

        <div v-if="!memorable" class="flex items-center justify-between">
          <label for="pg-symbols" class="text-sm font-medium">
            Symbols
          </label>
          <button
            id="pg-symbols"
            type="button"
            role="switch"
            :aria-checked="symbols"
            class="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            :class="symbols ? 'bg-primary' : 'bg-input'"
            @click="symbols = !symbols"
          >
            <span
              class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
              :class="symbols ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </div>

        <p v-if="memorable" class="text-xs text-muted-foreground">
          Format: NNNN-word-word-word (4 digits + 3 EFF words)
        </p>

        <div class="flex gap-2">
          <Button variant="outline" class="flex-1" @click="generate">
            <RefreshCw class="size-4 mr-2" />
            Regenerate
          </Button>
          <Button
            variant="default"
            class="flex-1"
            :disabled="!generated"
            @click="handleSave"
          >
            Save
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
