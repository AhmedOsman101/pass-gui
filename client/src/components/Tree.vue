<script setup lang="ts">
import { ChevronRight, File, Folder } from "@lucide/vue";
import { computed } from "vue";
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
import { useEntriesStore } from "@/stores/entries";
import type { EntryNode } from "@/types/entries";

const props = defineProps<{
  node: EntryNode;
}>();

const entries = useEntriesStore();

const isDirectory = computed(() => props.node.type === "DIRECTORY");

const isSelected = computed(() => entries.currentPath === props.node.path);

function handleSelect(): void {
  if (props.node.type === "FILE") {
    entries.selectEntry(props.node.path);
  }
}
</script>

<template>
  <SidebarMenuItem v-if="isDirectory">
    <Collapsible
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
          <Tree
            v-for="child in node.children"
            :key="child.path"
            :node="child"
          />
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  </SidebarMenuItem>

  <SidebarMenuItem v-else>
    <SidebarMenuButton
      :is-active="isSelected"
      class="data-[active=true]:bg-transparent"
      @click="handleSelect"
    >
      <File />
      {{ node.name }}
    </SidebarMenuButton>
  </SidebarMenuItem>
</template>
