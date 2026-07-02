<script setup lang="ts">
import { ChevronRight, Copy, File, Folder, FolderPlus, Pencil, Scissors, Trash2 } from "@lucide/vue";
import { computed, ref, TransitionGroup } from "vue";
import { useHotkey } from "@tanstack/vue-hotkeys";
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
} from "@/components/ui/sidebar";
import { useEntriesStore } from "@/stores/entries";
import { useTreeState } from "@/composables/useTreeState";
import CreateFolderDialog from "@/components/CreateFolderDialog.vue";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog.vue";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";

const entries = useEntriesStore();

const {
  visibleNodes,
  focusedPath,
  selectedPath,
  toggleDir,
  selectFile,
  toggleSelect,
  focusNext,
  focusPrev,
  focusSelect,
  arrowRight,
  arrowLeft,
} = useTreeState();

const isRenameOpen = ref(false);
const renamePath = ref<string | null>(null);
const isDeleteOpen = ref(false);
const deletePath = ref<string | null>(null);
const isCreateFolderOpen = ref(false);
const createFolderParent = ref<string | null>(null);

function openRename(path: string): void {
  renamePath.value = path;
  isRenameOpen.value = true;
}

function openDelete(path: string): void {
  deletePath.value = path;
  isDeleteOpen.value = true;
}

function openCreateFolder(path: string): void {
  createFolderParent.value = path;
  isCreateFolderOpen.value = true;
}

function nodeName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function dirPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function isSelectedNode(path: string): boolean {
  return selectedPath.value === path;
}

function isFocusedNode(path: string): boolean {
  return focusedPath.value === path;
}

function isCutDimmed(path: string): boolean {
  return entries.copyBuffer?.mode === "cut" && entries.copyBuffer.path === path;
}

function hasCopyBuffer(path: string): boolean {
  return !!entries.copyBuffer && entries.copyBuffer.path === path;
}

// Hotkeys — global for the tree
const hasSelected = computed(() => !!selectedPath.value);

useHotkey("F2", () => {
  if (selectedPath.value) openRename(selectedPath.value);
}, { enabled: hasSelected });

useHotkey("Delete", () => {
  if (selectedPath.value) openDelete(selectedPath.value);
}, { enabled: hasSelected });

// Keyboard navigation
useHotkey("ArrowDown", () => { focusNext(); });
useHotkey("ArrowUp", () => { focusPrev(); });
useHotkey("ArrowRight", () => { arrowRight(); });
useHotkey("ArrowLeft", () => { arrowLeft(); });
useHotkey("Enter", () => { focusSelect(); });
</script>

<template>
  <TransitionGroup
    tag="ul"
    data-slot="sidebar-menu"
    data-sidebar="menu"
    class="flex w-full min-w-0 flex-col gap-1"
    name="tree-node"
  >
    <SidebarMenuItem
      v-for="node in visibleNodes"
      :key="node.path"
    >
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <SidebarMenuButton
            :is-active="isSelectedNode(node.path)"
            class="overflow-hidden"
            :class="{
              'bg-accent/30': isFocusedNode(node.path) && !isSelectedNode(node.path),
              'cut-dimmed': isCutDimmed(node.path),
              'copy-pulse': hasCopyBuffer(node.path),
            }"
            :style="{ paddingLeft: `${12 + node.depth * 16}px` }"
            :title="nodeName(node.path)"
            @click="toggleSelect(node.path)"
          >
            <ChevronRight
              v-if="node.isDirectory"
              class="shrink-0 transition-transform duration-200"
              :class="{ 'rotate-90': node.isExpanded }"
              @click.stop="toggleDir(node.path)"
            />
            <Folder v-if="node.isDirectory" class="shrink-0 size-4" />
            <File v-else class="shrink-0 size-4" />
            <span class="truncate">{{ nodeName(node.path) }}</span>
          </SidebarMenuButton>
        </ContextMenuTrigger>

        <!-- Directory context menu -->
        <ContextMenuContent v-if="node.isDirectory" class="min-w-64 p-2">
          <ContextMenuItem v-if="entries.copyBuffer" @click="entries.pasteEntry(node.path)">
            <Copy class="size-4 mr-2" />
            Paste
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="openCreateFolder(node.path)">
            <FolderPlus class="size-4 mr-2" />
            New Folder
          </ContextMenuItem>
          <ContextMenuItem @click="openRename(node.path)">
            <Pencil class="size-4 mr-2" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem class="text-destructive" @click="openDelete(node.path)">
            <Trash2 class="size-4 mr-2" />
            Delete
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>

        <!-- File context menu -->
        <ContextMenuContent v-else class="min-w-64 p-2">
          <ContextMenuItem v-if="entries.copyBuffer" @click="entries.pasteEntry(dirPath(node.path))">
            <Copy class="size-4 mr-2" />
            Paste
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="entries.copyEntry(node.path)">
            <Copy class="size-4 mr-2" />
            Copy
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="entries.cutEntry(node.path)">
            <Scissors class="size-4 mr-2" />
            Cut
            <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="openRename(node.path)">
            <Pencil class="size-4 mr-2" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem class="text-destructive" @click="openDelete(node.path)">
            <Trash2 class="size-4 mr-2" />
            Delete
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuItem>
  </TransitionGroup>

  <RenameEntryDialog
    v-if="isRenameOpen && renamePath"
    :current-path="renamePath"
    v-model:open="isRenameOpen"
  />
  <DeleteConfirmDialog
    v-if="isDeleteOpen && deletePath"
    :entry-path="deletePath"
    v-model:open="isDeleteOpen"
  />
  <CreateFolderDialog
    v-if="isCreateFolderOpen && createFolderParent"
    :parent-path="createFolderParent"
    v-model:open="isCreateFolderOpen"
  />
</template>

<style>
.copy-pulse {
  animation: copy-pulse 1.5s ease-in-out infinite;
}
@keyframes copy-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.cut-dimmed {
  opacity: 0.4;
}

/* Expand/collapse slide animation for tree nodes */
.tree-node-enter-active,
.tree-node-leave-active {
  transition: all 200ms ease;
}
.tree-node-enter-from,
.tree-node-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.tree-node-leave-active {
  position: absolute;
}
.tree-node-move {
  transition: transform 200ms ease;
}
</style>
