<script setup lang="ts">
import { ChevronRight, Copy, File, Folder, Pencil, Trash2, ArrowRightLeft } from "@lucide/vue";
import { ref, computed } from "vue";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import { useEntriesStore } from "@/stores/entries";
import type { EntryNode } from "@/types/entries";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog.vue";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";

const props = defineProps<{
  node: EntryNode;
}>();

const entries = useEntriesStore();

const isDirectory = computed(() => props.node.type === "DIRECTORY");

const isSelected = computed(() => entries.currentPath === props.node.path);

const isRenameOpen = ref(false);
const isDeleteOpen = ref(false);

function handleSelect(): void {
  if (props.node.type === "FILE") {
    entries.selectEntry(props.node.path);
  }
}

function handleCopy(): void {
  entries.copyEntry(props.node.path);
}

function handleMove(): void {
  entries.cutEntry(props.node.path);
}

function handlePaste(): void {
  if (entries.copyBuffer) {
    entries.pasteEntry(props.node.path);
  }
}

function openRename(): void {
  isRenameOpen.value = true;
}

function openDelete(): void {
  isDeleteOpen.value = true;
}
</script>

<template>
  <SidebarMenuItem v-if="isDirectory">
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <Collapsible
          class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        >
          <CollapsibleTrigger as-child>
            <SidebarMenuButton
              class="overflow-hidden"
              :title="node.name"
            >
              <ChevronRight class="shrink-0 transition-transform" />
              <Folder class="shrink-0" />
              <span class="truncate">{{ node.name }}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub class="ml-3.5 mr-0 pl-2.5 pr-0">
              <Tree
                v-for="child in node.children"
                :key="child.path"
                :node="child"
              />
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </ContextMenuTrigger>
      <ContextMenuContent class="min-w-64 p-2">
        <ContextMenuItem v-if="entries.copyBuffer" @click="handlePaste">
          <Copy class="size-4 mr-2" />
          Paste
          <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem @click="openRename">
          <Pencil class="size-4 mr-2" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem class="text-destructive" @click="openDelete">
          <Trash2 class="size-4 mr-2" />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <RenameEntryDialog
      v-if="isRenameOpen"
      :current-path="node.path"
      v-model:open="isRenameOpen"
    />
    <DeleteConfirmDialog
      v-if="isDeleteOpen"
      :entry-path="node.path"
      v-model:open="isDeleteOpen"
    />
  </SidebarMenuItem>

  <SidebarMenuItem v-else>
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <SidebarMenuButton
          :is-active="isSelected"
          class="data-[active=true]:bg-transparent overflow-hidden"
          :title="node.name"
          @click="handleSelect"
        >
          <File class="shrink-0" />
          <span class="truncate">{{ node.name }}</span>
        </SidebarMenuButton>
      </ContextMenuTrigger>
      <ContextMenuContent class="min-w-64 p-2">
        <ContextMenuItem v-if="entries.copyBuffer" @click="handlePaste">
          <Copy class="size-4 mr-2" />
          Paste
          <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem @click="handleCopy">
          <Copy class="size-4 mr-2" />
          Copy
          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem @click="handleMove">
          <ArrowRightLeft class="size-4 mr-2" />
          Move
          <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem @click="openRename">
          <Pencil class="size-4 mr-2" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem class="text-destructive" @click="openDelete">
          <Trash2 class="size-4 mr-2" />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <RenameEntryDialog
      v-if="isRenameOpen"
      :current-path="node.path"
      v-model:open="isRenameOpen"
    />
    <DeleteConfirmDialog
      v-if="isDeleteOpen"
      :entry-path="node.path"
      v-model:open="isDeleteOpen"
    />
  </SidebarMenuItem>
</template>
