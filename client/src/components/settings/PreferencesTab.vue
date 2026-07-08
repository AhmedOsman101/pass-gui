<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const autoRefreshIntervalMs = defineModel<number>("autoRefreshIntervalMs", { required: true });

defineProps<{ isSaving: boolean }>();

const emit = defineEmits<{ save: [] }>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Preferences</CardTitle>
      <CardDescription>UI behavior preferences.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="refresh-interval">Auto Refresh Interval (ms)</Label>
        <Input
          id="refresh-interval"
          v-model.number="autoRefreshIntervalMs"
          type="number"
          :min="0"
          class="w-full"
        />
        <p class="text-xs text-muted-foreground">
          How often to auto-refresh the entry tree. 0 to disable.
        </p>
      </div>
      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('save')">Save</Button>
      </div>
    </CardContent>
  </Card>
</template>
