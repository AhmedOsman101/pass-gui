<script lang="ts" setup>
import type { DropdownMenuSubEmits, DropdownMenuSubProps } from "reka-ui";
import { DropdownMenuSub, useForwardPropsEmits } from "reka-ui";

const props = defineProps<DropdownMenuSubProps>();
const emits = defineEmits<DropdownMenuSubEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuSub
    data-slot="dropdown-menu-sub"
    v-slot="slotProps"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DropdownMenuSub>
</template>
