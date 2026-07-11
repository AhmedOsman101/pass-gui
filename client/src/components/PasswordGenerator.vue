<script setup lang="ts">
import { ref } from "vue";
import { Copy } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useClipboardStore } from "@/stores/clipboard";
import { usePasswordGenerator } from "@/composables/use-password-generator";
import GeneratorOptionsPanel from "@/components/GeneratorOptionsPanel.vue";

const clipboard = useClipboardStore();
const genOptions = usePasswordGenerator();

const emit = defineEmits<{
  (e: "save", password: string): void;
}>();

const isOpen = ref(false);

function copyToClipboard(): void {
  if (genOptions.generated) {
    void clipboard.copy(genOptions.generated, "password-generator");
  }
}

function handleSave(): void {
  if (genOptions.generated) {
    emit("save", genOptions.generated);
    isOpen.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
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

      <GeneratorOptionsPanel v-model:gen-state="genOptions" @regenerate="genOptions.regenerate" />

      <div class="flex gap-2">
        <Button
          variant="outline"
          class="flex-1"
          :disabled="!genOptions.generated"
          @click="copyToClipboard"
        >
          <Copy class="size-4 mr-2" />
          Copy
        </Button>
        <Button
          variant="default"
          class="flex-1"
          :disabled="!genOptions.generated"
          @click="handleSave"
        >
          Save
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
