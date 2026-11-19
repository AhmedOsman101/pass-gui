<script lang="ts" setup>
import type { DialogRootEmits, DialogRootProps } from "reka-ui";
import { DialogRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<DialogRootProps>();
const emits = defineEmits<DialogRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogRoot data-slot="sheet" v-slot="slotProps" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </DialogRoot>
</template>
