<script setup lang="ts">
import { Plus, Sparkles, Search, FolderPlus, ArrowUpDown, Check } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useHotkey } from "@tanstack/vue-hotkeys";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Tree from "@/components/Tree.vue";
import PasswordGenerator from "@/components/PasswordGenerator.vue";
import CreateFolderDialog from "@/components/CreateFolderDialog.vue";
import type { SidebarProps } from "@/components/ui/sidebar";
import type { SortMode } from "@/stores/entries";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntriesStore } from "@/stores/entries";
import type { EntryTree, EntryNode } from "@/types/entries";

const props = defineProps<SidebarProps>();

const entries = useEntriesStore();
const activeStore = useActiveStoreStore();

const hasSelection = computed(() => !!entries.currentPath);
const isCreateFolderOpen = ref(false);

const sortOptions: { value: SortMode; label: string }[] = [
  { value: "alphabetical", label: "A-Z" },
  { value: "reverse-alphabetical", label: "Z-A" },
];

function onPasswordSave(password: string): void {
  entries.openCreateForm(password);
}

watch(
  () => activeStore.hasStore,
  (ready) => {
    if (ready) entries.loadTree();
  },
  { immediate: true }
);

// Global hotkeys
useHotkey("Mod+C", () => {
  if (entries.currentPath) {
    entries.copyEntry(entries.currentPath);
  }
}, { enabled: hasSelection });

useHotkey("Mod+X", () => {
  if (entries.currentPath) {
    entries.cutEntry(entries.currentPath);
  }
}, { enabled: hasSelection });

useHotkey("Mod+V", () => {
  if (entries.copyBuffer) {
    const selected = entries.currentPath;
    if (selected) {
      const node = findNode(entries.tree, selected);
      const destDir = node?.type === "DIRECTORY"
        ? selected
        : selected.split("/").slice(0, -1).join("/");
      entries.pasteEntry(destDir);
    } else {
      entries.pasteEntry("");
    }
  }
}, { enabled: computed(() => !!entries.copyBuffer) });

function findNode(nodes: EntryTree, path: string): EntryNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

</script>

<template>
  <Sidebar v-bind="props" collapsible="none" class="w-full">
    <SidebarHeader class="border-b px-3 py-2">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold">pass-gui</span>
        <DropdownMenu v-if="entries.hasEntries">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs text-muted-foreground"
            >
              <ArrowUpDown class="size-3 mr-1" />
              {{ sortOptions.find(o => o.value === entries.sortMode)?.label }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-32">
            <DropdownMenuItem
              v-for="opt in sortOptions"
              :key="opt.value"
              @click="entries.setSortMode(opt.value)"
            >
              <Check
                class="size-4 mr-2"
                :class="entries.sortMode === opt.value ? 'opacity-100' : 'opacity-0'"
              />
              {{ opt.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SidebarHeader>
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel class="flex items-center justify-start mb-2">
              <div class="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-xs"
                  @click="entries.openCreateForm()"
                >
                  <Plus class="size-3 mr-1" />
                  New
                </Button>
                <PasswordGenerator @save="onPasswordSave">
                  <Button variant="outline" size="sm" class="h-7 px-2 text-xs">
                    <Sparkles class="size-3 mr-1" />
                    Generate
                  </Button>
                </PasswordGenerator>
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div class="px-2 pb-2">
                <div class="relative">
                  <Search
                    class="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                  />
                  <input
                    v-model="entries.searchQuery"
                    type="text"
                    placeholder="Search..."
                    class="w-full rounded-md border border-input bg-background px-8 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              </div>
              <SidebarMenu v-if="entries.hasEntries">
                <Tree
                  v-for="node in entries.filteredTree"
                  :key="node.path"
                  :node="node"
                />
              </SidebarMenu>
              <div
                v-else-if="!entries.isLoadingTree"
                class="px-4 py-8 text-center text-sm text-muted-foreground space-y-3"
              >
                <p>No entries yet.</p>
                <Button variant="outline" size="sm" @click="entries.openCreateForm()">
                  <Plus class="size-4 mr-1" />
                  Create your first entry
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </ContextMenuTrigger>
      <ContextMenuContent class="min-w-48 p-2">
        <ContextMenuItem @click="entries.openCreateForm()">
          <Plus class="size-4 mr-2" />
          New Entry
        </ContextMenuItem>
        <ContextMenuItem @click="isCreateFolderOpen = true">
          <FolderPlus class="size-4 mr-2" />
          New Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <CreateFolderDialog v-if="isCreateFolderOpen" v-model:open="isCreateFolderOpen" />
  </Sidebar>
</template>
