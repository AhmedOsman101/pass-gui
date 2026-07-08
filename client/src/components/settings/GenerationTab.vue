<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const memorable = defineModel<boolean>("memorable", { required: true });
const defaultLength = defineModel<number>("defaultLength", { required: true });
const symbols = defineModel<boolean>("symbols", { required: true });
const characterSet = defineModel<string>("characterSet", { required: true });
const characterSetNoSymbols = defineModel<string>("characterSetNoSymbols", { required: true });

defineProps<{ isSaving: boolean }>();

const emit = defineEmits<{ save: [] }>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Generation</CardTitle>
      <CardDescription>Default password generation options.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <Label for="memorable">Memorable Passwords</Label>
          <p class="text-xs text-muted-foreground">
            Use diceware-style memorable passwords.
          </p>
        </div>
        <Switch id="memorable" v-model:checked="memorable" />
      </div>

      <Separator />

      <div
        class="flex flex-col gap-2"
        :class="{ 'opacity-50 pointer-events-none': memorable }"
      >
        <Label for="default-length">Default Password Length</Label>
        <Input
          id="default-length"
          v-model.number="defaultLength"
          type="number"
          :min="8"
          :max="128"
          class="w-full"
        />
        <p class="text-xs text-muted-foreground">
          Length of generated passwords (8-128).
          <span v-if="memorable">Overridden by memorable mode.</span>
        </p>
      </div>

      <div
        class="flex items-center justify-between"
        :class="{ 'opacity-50 pointer-events-none': memorable }"
      >
        <div class="flex flex-col gap-1">
          <Label for="symbols">Include Symbols</Label>
          <p class="text-xs text-muted-foreground">
            Add symbols to generated passwords.
            <span v-if="memorable">Overridden by memorable mode.</span>
          </p>
        </div>
        <Switch id="symbols" v-model:checked="symbols" />
      </div>

      <Separator />

      <div class="flex flex-col gap-2">
        <Label for="charset">Character Set (with symbols)</Label>
        <Input id="charset" v-model="characterSet" class="font-mono" />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="charset-no-symbols">Character Set (without symbols)</Label>
        <Input
          id="charset-no-symbols"
          v-model="characterSetNoSymbols"
          class="font-mono"
        />
      </div>

      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('save')">Save</Button>
      </div>
    </CardContent>
  </Card>
</template>
