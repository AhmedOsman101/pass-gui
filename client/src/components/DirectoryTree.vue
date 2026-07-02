<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen } from "@lucide/vue";
import { ref } from "vue";
import type { EntryTree } from "@/types/entries";

const props = withDefaults(
  defineProps<{
    nodes: EntryTree;
    selectedPath: string;
    depth?: number;
  }>(),
  { depth: 0 },
);

const emit = defineEmits<{
  select: [path: string];
}>();

defineOptions({ name: "DirectoryTree" });

const expanded = ref(new Set<string>());

function toggle(path: string): void {
  const next = new Set(expanded.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  expanded.value = next;
}
</script>

<template>
  <template v-for="node in nodes" :key="node.path">
    <template v-if="node.type === 'DIRECTORY'">
      <button
        type="button"
        class="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-sm text-left transition-colors"
        :class="
          selectedPath === node.path
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50 hover:cursor-pointer'
        "
        :style="{ paddingLeft: `${8 + depth * 16}px` }"
        @click="emit('select', node.path)"
      >
        <ChevronRight
          class="size-3 shrink-0 transition-transform duration-150"
          :class="{ 'rotate-90': expanded.has(node.path) }"
          @click.stop="toggle(node.path)"
        />
        <FolderOpen v-if="selectedPath === node.path" class="size-4 shrink-0" />
        <Folder v-else class="size-4 shrink-0" />
        <span class="truncate">{{ node.name }}</span>
      </button>
      <DirectoryTree
        v-if="expanded.has(node.path) && node.children"
        :nodes="node.children"
        :selected-path="selectedPath"
        :depth="depth + 1"
        @select="(p: string) => emit('select', p)"
      />
    </template>
  </template>
</template>
