<script lang="ts" setup>
import {
  ChevronRight,
  Copy,
  File,
  Folder,
  FolderPlus,
  Pencil,
  Scissors,
  Trash2,
} from "@lucide/vue";
import { useHotkey } from "@tanstack/vue-hotkeys";
import { computed, ref, TransitionGroup } from "vue";
import CreateFolderDialog from "@/components/CreateFolderDialog.vue";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog.vue";
import RenameEntryDialog from "@/components/RenameEntryDialog.vue";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useNotifyResult } from "@/composables/use-notify-result";
import { useTreeState } from "@/composables/use-tree-state";
import { Logger } from "@/lib/logger";
import { Fs } from "@/services/filesystem";
import { useEntryTreeStore } from "@/stores/entry-tree";

const props = defineProps<{
  searchQuery?: string;
}>();

const treeStore = useEntryTreeStore();

const searchQueryRef = computed(() => props.searchQuery ?? "");

const {
  visibleNodes,
  focusedPath,
  selectedPath,
  toggleSelect,
  focusNext,
  focusPrev,
  focusSelect,
  arrowRight,
  arrowLeft,
} = useTreeState(searchQueryRef);

const isRenameOpen = ref(false);
const renamePath = ref<string | null>(null);
const renameNodeType = ref<"FILE" | "DIRECTORY">("FILE");
const isDeleteOpen = ref(false);
const deletePath = ref<string | null>(null);
const isCreateFolderOpen = ref(false);
const createFolderParent = ref<string | null>(null);

function openRename(path: string, nodeType?: "FILE" | "DIRECTORY"): void {
  renamePath.value = path;
  renameNodeType.value = nodeType ?? "FILE";
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

async function paste(destDir: string): Promise<void> {
  const result = await treeStore.pasteEntry(destDir);
  if (result) {
    useNotifyResult(result, { ok: a => `Pasted to ${a.path}` });
  }
}

/**
 * Pastes the buffer into the parent directory of `path`
 * (file context-menu "Paste" = paste next to this entry).
 */
async function pasteIntoParent(path: string): Promise<void> {
  const parts = await Fs.getPathParts(path);
  if (parts.isError()) {
    await Logger.error(
      `Paste aborted: cannot resolve parent of "${path}": ${parts.error.message}`
    );
    return;
  }
  await paste(parts.ok.parentPath);
}

function isSelectedNode(path: string): boolean {
  return selectedPath.value === path;
}

function isFocusedNode(path: string): boolean {
  return focusedPath.value === path;
}

function isCutDimmed(path: string): boolean {
  return treeStore.buffer?.mode === "cut" && treeStore.buffer.path === path;
}

function hasCopyBuffer(path: string): boolean {
  return !!treeStore.buffer && treeStore.buffer.path === path;
}

function isSearchMatch(path: string): boolean {
  if (!props.searchQuery) return false;
  return path.toLowerCase().includes(props.searchQuery.toLowerCase());
}

// Hotkeys — global for the tree
const hasSelected = computed(() => !!selectedPath.value);

useHotkey(
  "F2",
  () => {
    if (selectedPath.value) {
      const node = visibleNodes.value.find(n => n.path === selectedPath.value);
      openRename(selectedPath.value, node?.isDirectory ? "DIRECTORY" : "FILE");
    }
  },
  { enabled: hasSelected }
);

useHotkey(
  "Delete",
  () => {
    if (selectedPath.value) openDelete(selectedPath.value);
  },
  { enabled: hasSelected }
);

// Keyboard navigation
useHotkey("ArrowDown", () => {
  focusNext();
});
useHotkey("ArrowUp", () => {
  focusPrev();
});
useHotkey("ArrowRight", () => {
  arrowRight();
});
useHotkey("ArrowLeft", () => {
  arrowLeft();
});
useHotkey("Enter", () => {
  focusSelect();
});
</script>

<template>
  <TransitionGroup
    class="flex w-full min-w-0 flex-col gap-1"
    data-sidebar="menu"
    data-slot="sidebar-menu"
    name="tree-node"
    tag="ul"
  >
    <SidebarMenuItem v-for="node in visibleNodes" :key="node.path">
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <SidebarMenuButton
            class="overflow-hidden"
            :class="{
              'bg-accent/30':
                isFocusedNode(node.path) && !isSelectedNode(node.path),
              'cut-dimmed': isCutDimmed(node.path),
              'copy-pulse': hasCopyBuffer(node.path),
              'search-highlight': isSearchMatch(node.path),
            }"
            :is-active="isSelectedNode(node.path)"
            :style="{ paddingLeft: `${12 + node.depth * 16}px` }"
            :title="node.name"
            @click="toggleSelect(node.path)"
          >
            <ChevronRight
              class="shrink-0 transition-transform duration-200"
              v-if="node.isDirectory"
              :class="{ 'rotate-90': node.isExpanded }"
              @click.stop="toggleSelect(node.path)"
            />
            <Folder class="size-4 shrink-0" v-if="node.isDirectory" />
            <File class="size-4 shrink-0" v-else />
            <span class="truncate">{{ node.name }}</span>
          </SidebarMenuButton>
        </ContextMenuTrigger>

        <!-- Directory context menu -->
        <ContextMenuContent class="min-w-64 p-2" v-if="node.isDirectory">
          <ContextMenuItem v-if="treeStore.buffer" @click="paste(node.path)">
            <Copy class="mr-2 size-4" />
            Paste
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="openCreateFolder(node.path)">
            <FolderPlus class="mr-2 size-4" />
            New Folder
          </ContextMenuItem>
          <ContextMenuItem @click="openRename(node.path, 'DIRECTORY')">
            <Pencil class="mr-2 size-4" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            class="text-destructive"
            @click="openDelete(node.path)"
          >
            <Trash2 class="mr-2 size-4" />
            Delete
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>

        <!-- File context menu -->
        <ContextMenuContent class="min-w-64 p-2" v-else>
          <ContextMenuItem
            v-if="treeStore.buffer"
            @click="pasteIntoParent(node.path)"
          >
            <Copy class="mr-2 size-4" />
            Paste
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="treeStore.copyEntry(node.path, 'FILE')">
            <Copy class="mr-2 size-4" />
            Copy
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="treeStore.cutEntry(node.path, 'FILE')">
            <Scissors class="mr-2 size-4" />
            Cut
            <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem @click="openRename(node.path, 'FILE')">
            <Pencil class="mr-2 size-4" />
            Rename
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            class="text-destructive"
            @click="openDelete(node.path)"
          >
            <Trash2 class="mr-2 size-4" />
            Delete
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </SidebarMenuItem>
  </TransitionGroup>

  <RenameEntryDialog
    v-if="isRenameOpen && renamePath"
    v-model:open="isRenameOpen"
    :current-path="renamePath"
    :node-type="renameNodeType"
  />
  <DeleteConfirmDialog
    v-if="isDeleteOpen && deletePath"
    v-model:open="isDeleteOpen"
    :entry-path="deletePath"
  />
  <CreateFolderDialog
    v-if="isCreateFolderOpen && createFolderParent"
    v-model:open="isCreateFolderOpen"
    :parent-path="createFolderParent"
  />
</template>

<!-- biome-ignore lint/suspicious/useScopedStyles: Intentional -->
<style>
.copy-pulse {
  animation: copy-pulse 1.5s ease-in-out infinite;
}
@keyframes copy-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.cut-dimmed {
  opacity: 0.4;
}

.search-highlight {
  background-color: hsl(var(--accent) / 0.5);
  border-radius: calc(var(--radius) - 2px);
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
