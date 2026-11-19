<script lang="ts" setup>
import type { SelectRootEmits, SelectRootProps } from "reka-ui";
import { SelectRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<SelectRootProps>();
const emits = defineEmits<SelectRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectRoot data-slot="select" v-slot="slotProps" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
