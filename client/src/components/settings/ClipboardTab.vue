<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

const clearAfterSeconds = defineModel<number>("clearAfterSeconds", { required: true });
const selection = defineModel<"clipboard" | "primary" | "secondary">("selection", { required: true });

defineProps<{ isSaving: boolean }>();

const emit = defineEmits<{ save: [] }>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Clipboard</CardTitle>
      <CardDescription>Clipboard behavior after copying a password.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <Label for="clear-after">Clear After (seconds)</Label>
        <Input
          id="clear-after"
          v-model.number="clearAfterSeconds"
          type="number"
          :min="0"
          class="w-full"
        />
        <p class="text-xs text-muted-foreground">
          Seconds before clipboard is cleared. 0 to disable.
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="selection">Selection</Label>
        <Select v-model="selection">
          <SelectTrigger id="selection" class="w-full">
            <SelectValue placeholder="Select a selection" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="clipboard">clipboard</SelectItem>
              <SelectItem value="primary">primary</SelectItem>
              <SelectItem value="secondary">secondary</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          Which clipboard selection to use for copying.
        </p>
      </div>
      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('save')">Save</Button>
      </div>
    </CardContent>
  </Card>
</template>
