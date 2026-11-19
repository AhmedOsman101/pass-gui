<script lang="ts" setup>
import { Copy } from "@lucide/vue";
import { ref } from "vue";
import GeneratorOptionsPanel from "@/components/GeneratorOptionsPanel.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNotifyResult } from "@/composables/use-notify-result";
import { usePasswordGenerator } from "@/composables/use-password-generator";
import { useClipboardStore } from "@/stores/clipboard";

const emit = defineEmits<(e: "save", password: string) => void>();

const clipboard = useClipboardStore();
const genOptions = usePasswordGenerator();

const isOpen = ref(false);

async function copyToClipboard(): Promise<void> {
  if (!genOptions.generated) return;
  const result = await clipboard.copyWithTimeout(
    genOptions.generated,
    "password-generator"
  );
  useNotifyResult(result, { ok: "Password copied" });
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

      <GeneratorOptionsPanel
        v-model:gen-state="genOptions"
        @regenerate="genOptions.regenerate"
      />

      <div class="flex gap-2">
        <Button
          class="flex-1"
          variant="outline"
          :disabled="!genOptions.generated"
          @click="copyToClipboard"
        >
          <Copy class="mr-2 size-4" />
          Copy
        </Button>
        <Button
          class="flex-1"
          variant="default"
          :disabled="!genOptions.generated"
          @click="handleSave"
        >
          Save
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
