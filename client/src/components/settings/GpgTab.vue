<script setup lang="ts">
import { X } from "@lucide/vue";
import { onMounted, ref } from "vue";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Gpg } from "@/services/gpg";
import type { SecretKey } from "@/types";

const opts = defineModel<string[]>("opts", { required: true });
const signingKey = defineModel<string>("signingKey", { required: true });
const recipientKey = defineModel<string>("recipientKey", { required: true });

defineProps<{ isSaving: boolean }>();

const emit = defineEmits<{ save: [] }>();

const tagInput = ref("");
const tagInputRef = ref<HTMLInputElement | null>(null);
const secretKeys = ref<SecretKey[]>([]);
const signingKeyMode = ref<"select" | "custom">("select");
const recipientKeyMode = ref<"select" | "custom">("select");

onMounted(async () => {
  const result = await Gpg.listSecretKeys();
  if (result.isOk()) {
    secretKeys.value = result.ok;
  }
});

function addTag(): void {
  const raw = tagInput.value;
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return;

  const newOpts = [...opts.value];
  for (const part of parts) {
    if (!newOpts.includes(part)) {
      newOpts.push(part);
    }
  }
  opts.value = newOpts;
  tagInput.value = "";
}

function removeTag(index: number): void {
  opts.value = opts.value.filter((_, i) => i !== index);
}

function handleTagKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag();
  } else if (e.key === "Backspace" && tagInput.value === "" && opts.value.length > 0) {
    removeTag(opts.value.length - 1);
  }
}

function handleSigningKeyChange(raw: unknown): void {
  const value = String(raw ?? "");
  if (value === "__custom__") {
    signingKeyMode.value = "custom";
    signingKey.value = "";
  } else if (value === "__none__") {
    signingKeyMode.value = "select";
    signingKey.value = "";
  } else {
    signingKeyMode.value = "select";
    signingKey.value = value;
  }
}

function handleRecipientKeyChange(raw: unknown): void {
  const value = String(raw ?? "");
  if (value === "__custom__") {
    recipientKeyMode.value = "custom";
    recipientKey.value = "";
  } else if (value === "__none__") {
    recipientKeyMode.value = "select";
    recipientKey.value = "";
  } else {
    recipientKeyMode.value = "select";
    recipientKey.value = value;
  }
}

function keyLabel(k: SecretKey): string {
  const id = k.keyId.slice(-8);
  const name = k.userIds[0] ?? k.userId;
  return `${name} (${id})`;
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>GPG</CardTitle>
      <CardDescription>GPG options passed to pass.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label>Extra GPG Options</Label>
        <div
          class="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 font-mono text-sm"
          @click="tagInputRef?.focus()"
        >
          <span
            v-for="(tag, index) in opts"
            :key="index"
            class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"
          >
            {{ tag }}
            <button
              type="button"
              class="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              @click.stop="removeTag(index)"
            >
              <X class="size-3" />
            </button>
          </span>
          <input
            ref="tagInputRef"
            v-model="tagInput"
            type="text"
            placeholder="Type and press comma..."
            class="min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            @keydown="handleTagKeydown"
            @blur="addTag"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          Press comma or Enter to add. Backspace to remove last.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <Label>Signing Key</Label>
        <Select
          v-if="signingKeyMode === 'select'"
          :model-value="signingKey"
          @update:model-value="handleSigningKeyChange"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="None (use default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__none__">None (use default)</SelectItem>
              <SelectItem
                v-for="k in secretKeys"
                :key="k.keyId"
                :value="k.keyId"
              >
                {{ keyLabel(k) }}
              </SelectItem>
              <SelectItem value="__custom__">Custom...</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <div v-else class="flex gap-2">
          <Input
            v-model="signingKey"
            placeholder="Enter key ID or email"
            class="flex-1 font-mono"
          />
          <Button variant="outline" size="sm" @click="signingKeyMode = 'select'">
            List
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          Optional signing key for pass operations.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <Label>Recipient Key</Label>
        <Select
          v-if="recipientKeyMode === 'select'"
          :model-value="recipientKey"
          @update:model-value="handleRecipientKeyChange"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="None (use default)" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="__none__">None (use default)</SelectItem>
              <SelectItem
                v-for="k in secretKeys"
                :key="k.keyId"
                :value="k.keyId"
              >
                {{ keyLabel(k) }}
              </SelectItem>
              <SelectItem value="__custom__">Custom...</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <div v-else class="flex gap-2">
          <Input
            v-model="recipientKey"
            placeholder="Enter key ID or email"
            class="flex-1 font-mono"
          />
          <Button variant="outline" size="sm" @click="recipientKeyMode = 'select'">
            List
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          Optional recipient override key.
        </p>
      </div>

      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('save')">Save</Button>
      </div>
    </CardContent>
  </Card>
</template>
