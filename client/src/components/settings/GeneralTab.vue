<script setup lang="ts">
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { AppConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";

const props = defineProps<{
  config: ParsedToml<AppConfig>;
  stores: Record<string, { path: string; gnupg_home?: string }>;
  isSaving: boolean;
}>();

const emit = defineEmits<{
  save: [];
}>();

const activeStore = defineModel<string>("activeStore", { required: true });
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>General</CardTitle>
      <CardDescription>Core application settings.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="active-store">Active Store</Label>
        <Select v-model="activeStore">
          <SelectTrigger id="active-store" class="w-full">
            <SelectValue placeholder="Select a store" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="(store, name) in stores"
                :key="name"
                :value="name"
              >
                <span class="flex w-full items-center justify-between">
                  <span>{{ name }}</span>
                  <span class="ml-4 text-xs text-muted-foreground">{{ store.path }}</span>
                </span>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          Which password store is currently active.
        </p>
      </div>
      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('save')">
          Save
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
