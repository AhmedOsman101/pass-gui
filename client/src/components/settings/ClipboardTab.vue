<script setup lang="ts">
import { Info } from "@lucide/vue";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <div class="flex items-center gap-1.5">
          <Label for="selection">Selection</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Info class="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent class="max-w-80">
                <div class="flex flex-col gap-1 text-xs">
                  <span><strong>Clipboard</strong> — standard copy/paste buffer (Ctrl+C/Ctrl+V).</span>
                  <span><strong>Primary</strong> — X11 middle-click paste buffer (select text, paste with middle mouse button).</span>
                  <span><strong>Secondary</strong> — rarely used third buffer, mostly for inter-app communication.</span>
                  <span class="text-muted-foreground">On macOS/Windows, only <strong>clipboard</strong> is meaningful.</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
