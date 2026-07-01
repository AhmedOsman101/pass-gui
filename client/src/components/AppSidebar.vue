<script setup lang="ts">
import { Plus, Sparkles, Search } from "@lucide/vue";
import { watch } from "vue";
import { Button } from "@/components/ui/button";
import Tree from "@/components/Tree.vue";
import GenerateDialog from "@/components/GenerateDialog.vue";
import InsertDialog from "@/components/InsertDialog.vue";
import type { SidebarProps } from "@/components/ui/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useActiveStoreStore } from "@/stores/active-store";
import { useEntriesStore } from "@/stores/entries";

const props = defineProps<SidebarProps>();

const entries = useEntriesStore();
const activeStore = useActiveStoreStore();

watch(
  () => activeStore.hasStore,
  (ready) => {
    if (ready) entries.loadTree();
  },
  { immediate: true }
);
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel class="flex items-center justify-between">
          <span>Entries</span>
          <div class="flex items-center gap-1">
            <InsertDialog>
              <Button variant="ghost" size="icon" class="size-5">
                <Plus class="size-3" />
              </Button>
            </InsertDialog>
            <GenerateDialog>
              <Button variant="ghost" size="icon" class="size-5">
                <Sparkles class="size-3" />
              </Button>
            </GenerateDialog>
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
                placeholder="Search…"
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
            <InsertDialog>
              <Button variant="outline" size="sm">
                <Plus class="size-4 mr-1" />
                Create your first entry
              </Button>
            </InsertDialog>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
</template>
