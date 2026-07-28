import { computed, type Ref, ref, shallowRef, toRef, watch } from "vue";
import { buildIndex } from "@/lib/tree-index";
import { buildSearchResults, buildVisible, toggleSet } from "@/lib/tree-state";
import { useEntryTreeStore } from "@/stores/entry-tree";
import type { TreeIndex } from "@/types/entries";

export function useTreeState(searchQuery?: Ref<string>) {
  const treeStore = useEntryTreeStore();

  const index = shallowRef<TreeIndex>(buildIndex(treeStore.tree));

  watch(
    () => treeStore.tree,
    newTree => {
      const newIndex = buildIndex(newTree);
      index.value = newIndex;

      const valid = new Set<string>();
      for (const path of expandedDirs.value) {
        if (newIndex.byPath.has(path)) {
          valid.add(path);
        }
      }
      expandedDirs.value = valid;
    },
    { deep: false }
  );

  const expandedDirs = ref(new Set<string>());
  const focusedPath = ref<string | null>(null);

  const query = computed(() => searchQuery?.value ?? "");

  const mode = computed(() => (query.value ? "search" : "tree"));

  const visibleNodes = computed(() => {
    if (mode.value === "search") {
      return buildSearchResults(index.value, query.value);
    }
    return buildVisible(index.value, expandedDirs.value, treeStore.sortMode);
  });

  function toggleDir(path: string): void {
    expandedDirs.value = toggleSet(index.value, expandedDirs.value, path);
  }

  function selectFile(path: string): void {
    const node = index.value.byPath.get(path);
    if (!node) return;

    if (node.type === "FILE") {
      treeStore.selectEntry(path);
    } else {
      treeStore.setSelectedPath(path);
    }
  }

  function toggleSelect(path: string): void {
    const node = index.value.byPath.get(path);
    if (!node) return;

    if (node.type === "DIRECTORY") {
      toggleDir(path);
    }
    selectFile(path);
  }

  function focusNext(): void {
    const nodes = visibleNodes.value;
    if (nodes.length === 0) return;

    const idx = focusedPath.value
      ? Math.max(
          0,
          nodes.findIndex(n => n.path === focusedPath.value)
        )
      : -1;
    const next = idx < nodes.length - 1 ? idx + 1 : 0;
    focusedPath.value = nodes[next]?.path ?? null;
  }

  function focusPrev(): void {
    const nodes = visibleNodes.value;
    if (nodes.length === 0) return;

    const idx = focusedPath.value
      ? Math.max(
          0,
          nodes.findIndex(n => n.path === focusedPath.value)
        )
      : 0;
    const prev = idx > 0 ? idx - 1 : nodes.length - 1;
    focusedPath.value = nodes[prev]?.path ?? null;
  }

  function focusSelect(): void {
    if (!focusedPath.value) return;
    selectFile(focusedPath.value);
  }

  function arrowRight(): void {
    const fp = focusedPath.value;
    if (!fp) return;

    const node = index.value.byPath.get(fp);
    if (node?.type !== "DIRECTORY") return;

    if (!expandedDirs.value.has(fp)) {
      toggleDir(fp);
    } else {
      const children = index.value.children.get(fp) ?? [];
      if (children.length > 0) {
        focusedPath.value = children[0] ?? null;
      }
    }
  }

  function arrowLeft(): void {
    const fp = focusedPath.value;
    if (!fp) return;

    if (expandedDirs.value.has(fp)) {
      toggleDir(fp);
    } else {
      const p = index.value.parent.get(fp);
      if (p) {
        focusedPath.value = p;
      }
    }
  }

  return {
    visibleNodes,
    expandedDirs,
    focusedPath,
    selectedPath: toRef(treeStore, "selectedPath"),
    mode,
    index,
    toggleDir,
    selectFile,
    toggleSelect,
    focusNext,
    focusPrev,
    focusSelect,
    arrowRight,
    arrowLeft,
  };
}
