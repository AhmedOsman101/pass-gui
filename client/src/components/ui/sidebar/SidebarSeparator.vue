<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <Separator
    data-sidebar="separator"
    data-slot="sidebar-separator"
    :class="cn('bg-sidebar-border mx-2 w-auto', props.class)"
  >
    <slot />
  </Separator>
</template>
