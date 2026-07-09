<script setup lang="ts">
import { Info } from "@lucide/vue";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
        <Switch id="memorable" v-model="memorable" />
      </div>

      <Transition name="hide">
        <div v-show="!memorable" class="flex flex-col gap-4">
          <Separator />

          <div class="flex flex-col gap-2">
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
            </p>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-1">
              <Label for="symbols">Include Symbols</Label>
              <p class="text-xs text-muted-foreground">
                Add symbols to generated passwords.
              </p>
            </div>
            <Switch id="symbols" v-model="symbols" />
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-1.5">
              <Label for="charset">Character Set (with symbols)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Info class="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent class="max-w-80">
                    <p class="text-xs">
                      POSIX character classes like <code>[[:alnum:]]</code> (letters + digits) and
                      <code>[[:punct:]]</code> (punctuation). You can also use literal characters
                      or ranges like <code>a-zA-Z0-9</code>.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input id="charset" v-model="characterSet" class="font-mono" />
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-1.5">
              <Label for="charset-no-symbols">Character Set (without symbols)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Info class="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent class="max-w-80">
                    <p class="text-xs">
                      Character set used when symbols are disabled. Default:
                      <code>[[:alnum:]]</code> (letters + digits only).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="charset-no-symbols"
              v-model="characterSetNoSymbols"
              class="font-mono"
            />
          </div>
        </div>
      </Transition>

      <Separator />
      <div class="flex justify-end">
        <Button :disabled="isSaving" @click="emit('save')">Save</Button>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.hide-leave-active,
.hide-enter-active {
  transition: all 0.2s ease;
}
.hide-enter-from,
.hide-leave-to {
  opacity: 0;
}
</style>
