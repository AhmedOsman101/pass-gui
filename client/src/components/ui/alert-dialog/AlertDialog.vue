<script lang="ts" setup>
import type { AlertDialogEmits, AlertDialogProps } from "reka-ui";
import { AlertDialogRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<AlertDialogProps>();
const emits = defineEmits<AlertDialogEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <AlertDialogRoot
    data-slot="alert-dialog"
    v-slot="slotProps"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </AlertDialogRoot>
</template>
