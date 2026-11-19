<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <Input
    data-sidebar="input"
    data-slot="sidebar-input"
    :class="cn('bg-background h-8 w-full shadow-none', props.class)"
  >
    <slot />
  </Input>
</template>
