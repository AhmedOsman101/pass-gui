<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const enabled = defineModel<boolean>("enabled", { required: true });

defineProps<{ isSaving: boolean }>();

const emit = defineEmits<{ save: [] }>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Extensions</CardTitle>
      <CardDescription>Pass extension support.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <Label for="extensions-enabled">Enable Extensions</Label>
          <p class="text-muted-foreground text-xs">
            Enable pass extension support.
          </p>
        </div>
        <Switch id="extensions-enabled" v-model="enabled" />
      </div>
      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('save')">Save</Button>
      </div>
    </CardContent>
  </Card>
</template>
