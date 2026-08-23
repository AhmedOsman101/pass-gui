<script setup lang="ts">
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
import { Pass } from "@/services/pass";
import { Watcher } from "@/services/watcher";
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntryFormStore } from "@/stores/entry-form";
import { useEntryTreeStore } from "@/stores/entry-tree";
import type { EntryNode, EntryTree } from "@/types/entries";
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
import { computed, onUnmounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

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
  (ready) => {
    if (ready) treeStore.loadTree();
  },
  { immediate: true },
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
  { enabled: hasSelection },
);

useHotkey(
  "Mod+X",
  () => {
    if (treeStore.selectedPath) {
      const node = findNode(treeStore.tree, treeStore.selectedPath);
      treeStore.cutEntry(treeStore.selectedPath, node?.type);
    }
  },
  { enabled: hasSelection },
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
  { enabled: computed(() => !!treeStore.buffer) },
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

// Polls the active store's `.gpg-id`: when it changes on disk (recipients
// edited externally), refreshes the entry tree every 2s. Re-runs on store switch.
let watchTimer: ReturnType<typeof setInterval> | null = null;

async function startStoreWatcher(): Promise<void> {
  if (Pass.storePath) {
    await Watcher.watch("store", Pass.storePath, ".gpg-id");
  }
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = setInterval(() => {
    if (Watcher.hasChanged("store")) {
      treeStore.refresh();
    }
  }, 2000);
}

watch(() => Pass.storePath, startStoreWatcher, { immediate: true });

onUnmounted(() => {
  if (watchTimer) clearInterval(watchTimer);
  Watcher.unwatch("store");
});
</script>

<template>
  <Sidebar v-bind="props" collapsible="none" class="w-full">
    <SidebarHeader class="border-b px-3 py-2">
      <div class="flex items-center justify-between">
        <RouterLink to="/test"><span class="text-sm font-semibold">pass-gui</span></RouterLink>
        <div class="flex items-center gap-1">
          <DropdownMenu v-if="treeStore.hasEntries">
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs text-muted-foreground"
              >
                <ArrowUpDown class="size-3 mr-1" />
                {{
                  sortOptions.find((o) => o.value === treeStore.sortMode)?.label
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
                  class="size-4 mr-2"
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
            to="/settings"
            class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
            <SidebarGroupLabel class="flex items-center justify-start mb-2">
              <div class="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 px-2 text-xs"
                  @click="formStore.openCreateForm()"
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
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search..."
                    class="w-full rounded-md border border-input bg-background px-8 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              </div>
              <Tree
                v-if="treeStore.hasEntries"
                :search-query="debouncedSearch"
              />
              <SidebarMenuSkeleton
                v-else-if="treeStore.isLoadingTree"
                class="mx-2"
              />
              <div
                v-else-if="!treeStore.isLoadingTree"
                class="px-4 py-8 text-center text-sm text-muted-foreground space-y-3"
              >
                <p>No entries yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  @click="formStore.openCreateForm()"
                >
                  <Plus class="size-4 mr-1" />
                  Create your first entry
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </ContextMenuTrigger>
      <ContextMenuContent class="min-w-48 p-2">
        <ContextMenuItem @click="formStore.openCreateForm()">
          <Plus class="size-4 mr-2" />
          New Entry
        </ContextMenuItem>
        <ContextMenuItem @click="isCreateFolderOpen = true">
          <FolderPlus class="size-4 mr-2" />
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
