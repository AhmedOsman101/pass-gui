<script lang="ts" setup>
import {
  ArrowUpDown,
  Check,
  FolderPlus,
  Plus,
  Search,
  Settings,
  Sparkles,
} from "@lucide/vue";
import { useHotkey } from "@tanstack/vue-hotkeys";
import { refDebounced } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import CreateFolderDialog from "@/components/CreateFolderDialog.vue";
import PasswordGenerator from "@/components/PasswordGenerator.vue";
import Tree from "@/components/Tree.vue";
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
import type { SidebarProps } from "@/components/ui/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useNotifyResult } from "@/composables/use-notify-result";
import { Logger } from "@/lib/logger";
import type { SortMode } from "@/lib/tree-state";
import { Fs } from "@/services/filesystem";
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntryFormStore } from "@/stores/entry-form";
import { useEntryTreeStore } from "@/stores/entry-tree";
import type { EntryNode, EntryTree } from "@/types/entries";

const props = defineProps<SidebarProps>();

const treeStore = useEntryTreeStore();
const formStore = useEntryFormStore();
const activeStore = useActiveStoreStore();

const hasSelection = computed(() => !!treeStore.selectedPath);
const isCreateFolderOpen = ref(false);

const searchQuery = ref("");
const debouncedSearch = refDebounced(searchQuery, 300);

const sortOptions: { value: SortMode; label: string }[] = [
  { value: "alphabetical", label: "A-Z" },
  { value: "reverse-alphabetical", label: "Z-A" },
];

function onPasswordSave(password: string): void {
  formStore.openCreateForm(password);
}

watch(
  () => activeStore.hasStore,
  ready => {
    if (ready) treeStore.loadTree();
  },
  { immediate: true }
);

// Global hotkeys
useHotkey(
  "Mod+C",
  () => {
    if (treeStore.selectedPath) {
      const node = findNode(treeStore.tree, treeStore.selectedPath);
      treeStore.copyEntry(treeStore.selectedPath, node?.type);
    }
  },
  { enabled: hasSelection }
);

useHotkey(
  "Mod+X",
  () => {
    if (treeStore.selectedPath) {
      const node = findNode(treeStore.tree, treeStore.selectedPath);
      treeStore.cutEntry(treeStore.selectedPath, node?.type);
    }
  },
  { enabled: hasSelection }
);

useHotkey(
  "Mod+V",
  () => {
    if (treeStore.buffer) {
      const selected = treeStore.selectedPath;
      if (!selected) {
        void pasteInto("");
        return;
      }
      const node = findNode(treeStore.tree, selected);
      if (node?.type === "DIRECTORY") {
        void pasteInto(selected);
        return;
      }
      void (async () => {
        const parts = await Fs.getPathParts(selected);
        if (parts.isError()) {
          await Logger.error(
            `Paste aborted: cannot resolve parent of "${selected}": ${parts.error.message}`
          );
          return;
        }
        await pasteInto(parts.ok.parentPath);
      })();
    }
  },
  { enabled: computed(() => !!treeStore.buffer) }
);

async function pasteInto(destDir: string): Promise<void> {
  const result = await treeStore.pasteEntry(destDir);
  if (result) {
    useNotifyResult(result, { ok: a => `Pasted to ${a.path}` });
  }
}

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
  <Sidebar v-bind="props" class="w-full" collapsible="none">
    <SidebarHeader class="border-b px-3 py-2">
      <div class="flex items-center justify-between">
        <RouterLink to="/test"
          ><span class="text-sm font-semibold">pass-gui</span></RouterLink
        >
        <div class="flex items-center gap-1">
          <DropdownMenu v-if="treeStore.hasEntries">
            <DropdownMenuTrigger as-child>
              <Button
                class="text-muted-foreground h-7 px-2 text-xs"
                size="sm"
                variant="ghost"
              >
                <ArrowUpDown class="mr-1 size-3" />
                {{
                  sortOptions.find(o => o.value === treeStore.sortMode)?.label
                }}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="min-w-32">
              <DropdownMenuItem
                v-for="opt in sortOptions"
                :key="opt.value"
                @click="treeStore.setSortMode(opt.value)"
              >
                <Check
                  class="mr-2 size-4"
                  :class="
                    treeStore.sortMode === opt.value
                      ? 'opacity-100'
                      : 'opacity-0'
                  "
                />
                {{ opt.label }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <RouterLink
            class="text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex size-7 items-center justify-center rounded-md"
            to="/settings"
          >
            <Settings class="size-4" />
          </RouterLink>
        </div>
      </div>
    </SidebarHeader>
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel class="mb-2 flex items-center justify-start">
              <div class="flex items-center gap-1">
                <Button
                  class="h-7 px-2 text-xs"
                  size="sm"
                  variant="outline"
                  @click="formStore.openCreateForm()"
                >
                  <Plus class="mr-1 size-3" />
                  New
                </Button>
                <PasswordGenerator @save="onPasswordSave">
                  <Button class="h-7 px-2 text-xs" size="sm" variant="outline">
                    <Sparkles class="mr-1 size-3" />
                    Generate
                  </Button>
                </PasswordGenerator>
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div class="px-2 pb-2">
                <div class="relative">
                  <Search
                    class="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2"
                  />
                  <input
                    class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-8 py-1.5 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    placeholder="Search..."
                    type="text"
                    v-model="searchQuery"
                  >
                </div>
              </div>
              <Tree
                v-if="treeStore.hasEntries"
                :search-query="debouncedSearch"
              />
              <SidebarMenuSkeleton
                class="mx-2"
                v-else-if="treeStore.isLoadingTree"
              />
              <div
                class="text-muted-foreground space-y-3 px-4 py-8 text-center text-sm"
                v-else-if="!treeStore.isLoadingTree"
              >
                <p>No entries yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  @click="formStore.openCreateForm()"
                >
                  <Plus class="mr-1 size-4" />
                  Create your first entry
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </ContextMenuTrigger>
      <ContextMenuContent class="min-w-48 p-2">
        <ContextMenuItem @click="formStore.openCreateForm()">
          <Plus class="mr-2 size-4" />
          New Entry
        </ContextMenuItem>
        <ContextMenuItem @click="isCreateFolderOpen = true">
          <FolderPlus class="mr-2 size-4" />
          New Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <CreateFolderDialog
      v-if="isCreateFolderOpen"
      v-model:open="isCreateFolderOpen"
    />
  </Sidebar>
</template>
