<script setup lang="ts">
import { ChevronRight, Copy, File, Folder, Pencil, Trash2, ArrowRightLeft, FolderPlus } from "@lucide/vue";
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
import CreateFolderDialog from "@/components/CreateFolderDialog.vue";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog.vue";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";

const props = defineProps<{
  node: EntryNode;
}>();

const entries = useEntriesStore();

const isDirectory = computed(() => props.node.type === "DIRECTORY");
const isEmpty = computed(
  () => isDirectory.value && (!props.node.children || props.node.children.length === 0)
);
const isSelected = computed(() => entries.currentPath === props.node.path);

const isRenameOpen = ref(false);
const isDeleteOpen = ref(false);
const isCreateFolderOpen = ref(false);

// For empty dirs: manual arrow toggle without Collapsible expansion
const emptyOpen = ref(false);

function handleSelect(): void {
  if (props.node.type === "FILE") {
    entries.selectEntry(props.node.path);
  }
}

function handleDirClick(): void {
  entries.setCurrentPath(props.node.path);
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
        <!-- Empty directory: no Collapsible, just arrow toggle -->
        <SidebarMenuButton
          v-if="isEmpty"
          class="overflow-hidden"
          :title="node.name"
          @click="emptyOpen = !emptyOpen; handleDirClick()"
        >
          <ChevronRight
            class="shrink-0 transition-transform duration-200"
            :class="{ 'rotate-90': emptyOpen }"
          />
          <Folder class="shrink-0" />
          <span class="truncate">{{ node.name }}</span>
        </SidebarMenuButton>

        <!-- Non-empty directory: Collapsible with expand/collapse -->
        <Collapsible
          v-else
          v-slot="{ open }"
        >
          <CollapsibleTrigger as-child>
            <SidebarMenuButton
              class="overflow-hidden"
              :title="node.name"
              @click="handleDirClick"
            >
              <ChevronRight
                class="shrink-0 transition-transform duration-200"
                :class="{ 'rotate-90': open }"
              />
              <Folder class="shrink-0" />
              <span class="truncate">{{ node.name }}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent class="collapsible-slide">
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
        <ContextMenuItem @click="isCreateFolderOpen = true">
          <FolderPlus class="size-4 mr-2" />
          New Folder
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

    <CreateFolderDialog
      v-if="isCreateFolderOpen"
      :parent-path="node.path"
      v-model:open="isCreateFolderOpen"
    />
    <RenameEntryDialog
      v-if="isRenameOpen"
      :current-path="node.path"
      node-type="DIRECTORY"
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
          class="overflow-hidden"
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

<style>
/* Smooth expand/collapse animation for CollapsibleContent */
.collapsible-slide {
  overflow: hidden;
}
.collapsible-slide[data-state="open"] {
  animation: collapsible-open 200ms ease-out;
}
.collapsible-slide[data-state="closed"] {
  animation: collapsible-close 150ms ease-in;
}
@keyframes collapsible-open {
  from {
    height: 0;
    opacity: 0;
  }
  to {
    height: var(--reka-collapsible-content-height);
    opacity: 1;
  }
}
@keyframes collapsible-close {
  from {
    height: var(--reka-collapsible-content-height);
    opacity: 1;
  }
  to {
    height: 0;
    opacity: 0;
  }
}
</style>
