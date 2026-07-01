<script setup lang="ts">
import { ChevronRight, File, Folder } from "@lucide/vue";
import { computed, ref } from "vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntriesStore } from "@/stores/entries";
import type { EntryNode } from "@/types/entries";

const props = defineProps<{
  node: EntryNode;
  depth?: number;
}>();

const entries = useEntriesStore();
const activeStore = useActiveStoreStore();
const isOpen = ref(true);

const isSelected = computed(
  () => entries.currentPath === props.node.path
);

const isDirectory = computed(() => props.node.type === "DIRECTORY");

function handleClick(): void {
  if (!isDirectory.value && activeStore.hasStore) {
    entries.selectEntry(props.node.path);
  }
}
</script>

<template>
  <SidebarMenuItem v-if="isDirectory">
    <Collapsible
      v-model:open="isOpen"
      class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
    >
      <CollapsibleTrigger as-child>
        <SidebarMenuButton>
          <ChevronRight class="transition-transform" />
          <Folder />
          {{ node.name }}
        </SidebarMenuButton>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          <EntryTree
            v-for="child in node.children"
            :key="child.path"
            :node="child"
            :depth="(depth ?? 0) + 1"
          />
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  </SidebarMenuItem>

  <SidebarMenuItem v-else>
    <SidebarMenuButton
      :is-active="isSelected"
      class="data-[active=true]:bg-transparent"
      @click="handleClick"
    >
      <File />
      {{ node.name }}
    </SidebarMenuButton>
  </SidebarMenuItem>
</template>
