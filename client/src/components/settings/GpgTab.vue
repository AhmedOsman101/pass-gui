<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const opts = defineModel<string>("opts", { required: true });
const signingKey = defineModel<string>("signingKey", { required: true });
const key = defineModel<string>("key", { required: true });

defineProps<{ isSaving: boolean }>();

const emit = defineEmits<{ save: [] }>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>GPG</CardTitle>
      <CardDescription>GPG options passed to pass.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="gpg-opts">Extra GPG Options</Label>
        <Input
          id="gpg-opts"
          v-model="opts"
          placeholder="--no-tty, --batch"
          class="font-mono"
        />
        <p class="text-xs text-muted-foreground">
          Comma-separated extra options passed to GPG.
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="signing-key">Signing Key</Label>
        <Input
          id="signing-key"
          v-model="signingKey"
          placeholder="Optional"
          class="font-mono"
        />
        <p class="text-xs text-muted-foreground">
          Optional signing key for pass operations.
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="gpg-key">Recipient Key</Label>
        <Input
          id="gpg-key"
          v-model="key"
          placeholder="Optional"
          class="font-mono"
        />
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
