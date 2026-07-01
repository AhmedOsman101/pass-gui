import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { Entries } from "@/services/entries";
import type { EntryDetail, EntryTree } from "@/types/entries";

/**
 * Manages the password entry tree and currently selected entry.
 *
 * Calls `Entries.list()` and `Entries.show()` services,
 * maps results to reactive state. Search filtering happens
 * via computed — no service calls for filtering.
 */
const useEntriesStore = defineStore("entries", () => {
  const tree = ref<EntryTree>([]);
  const currentPath = ref<string | null>(null);
  const currentEntry = ref<EntryDetail | null>(null);
  const isLoadingTree = ref(false);
  const isLoadingEntry = ref(false);
  const showEntrySkeleton = ref(false);
  const searchQuery = ref("");
  const error = ref<string | null>(null);
  const copyBuffer = ref<{ path: string; mode: "copy" | "cut" } | null>(null);

  const skeletonTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const SKELETON_DELAY_MS = 500;

  const filteredTree = computed<EntryTree>(() => {
    if (!searchQuery.value) return tree.value;

    const query = searchQuery.value.toLowerCase();

    function filterNodes(nodes: EntryTree): EntryTree {
      return nodes
        .filter(
          node =>
            node.name.toLowerCase().includes(query) ||
            node.path.toLowerCase().includes(query)
        )
        .map(node => ({
          ...node,
          children: node.children ? filterNodes(node.children) : undefined,
        }));
    }

    return filterNodes(tree.value);
  });

  const hasEntries = computed(() => tree.value.length > 0);

  async function loadTree(): Promise<void> {
    isLoadingTree.value = true;
    error.value = null;

    try {
      const result = await Entries.list();
      if (result.isError()) {
        error.value = result.error.message;
        return;
      }
      tree.value = result.ok;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isLoadingTree.value = false;
    }
  }

  async function selectEntry(path: string): Promise<void> {
    if (currentPath.value === path && currentEntry.value) return;

    currentPath.value = path;
    isLoadingEntry.value = true;
    showEntrySkeleton.value = false;
    error.value = null;

    if (skeletonTimer.value) clearTimeout(skeletonTimer.value);
    skeletonTimer.value = setTimeout(() => {
      showEntrySkeleton.value = true;
    }, SKELETON_DELAY_MS);

    try {
      const result = await Entries.show(path);
      if (result.isError()) {
        error.value = result.error.message;
        currentEntry.value = null;
        return;
      }
      currentEntry.value = result.ok;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      currentEntry.value = null;
    } finally {
      if (skeletonTimer.value) {
        clearTimeout(skeletonTimer.value);
        skeletonTimer.value = null;
      }
      showEntrySkeleton.value = false;
      isLoadingEntry.value = false;
    }
  }

  function clearSelection(): void {
    currentPath.value = null;
    currentEntry.value = null;
  }

  async function refresh(): Promise<void> {
    await loadTree();
  }

  async function insertEntry(
    path: string,
    content: string
  ): Promise<string | null> {
    error.value = null;
    const result = await Entries.insert({ path, content });
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    await refresh();
    return null;
  }

  async function generateEntry(
    path: string,
    options?: { length?: number; symbols?: boolean; memorable?: boolean }
  ): Promise<string | null> {
    error.value = null;
    const result = await Entries.generate(path, options);
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    await refresh();
    return null;
  }

  async function removeEntry(path: string): Promise<string | null> {
    error.value = null;
    const result = await Entries.remove(path);
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    clearSelection();
    await refresh();
    return null;
  }

  async function moveEntry(
    oldPath: string,
    newPath: string
  ): Promise<string | null> {
    error.value = null;
    const result = await Entries.move(oldPath, newPath);
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    await refresh();
    return null;
  }

  async function duplicateEntry(
    sourcePath: string,
    destPath: string
  ): Promise<string | null> {
    error.value = null;
    const result = await Entries.copy(sourcePath, destPath);
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    await refresh();
    return null;
  }

  async function editEntry(
    path: string,
    content: string
  ): Promise<string | null> {
    error.value = null;
    const result = await Entries.edit(path, content);
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    await selectEntry(path);
    return null;
  }

  function copyEntry(path: string): void {
    copyBuffer.value = { path, mode: "copy" };
  }

  function cutEntry(path: string): void {
    copyBuffer.value = { path, mode: "cut" };
  }

  async function pasteEntry(destinationDir: string): Promise<string | null> {
    if (!copyBuffer.value) return null;

    error.value = null;
    const { path: sourcePath, mode } = copyBuffer.value;
    const fileName = sourcePath.split("/").pop() as string;
    const destPath = destinationDir
      ? `${destinationDir}/${fileName}`
      : fileName;

    let result:
      | Awaited<ReturnType<typeof Entries.copy>>
      | Awaited<ReturnType<typeof Entries.move>>;
    if (mode === "copy") {
      result = await Entries.copy(sourcePath, destPath);
    } else {
      result = await Entries.move(sourcePath, destPath);
    }

    copyBuffer.value = null;

    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    await refresh();
    return null;
  }

  return {
    tree,
    currentPath,
    currentEntry,
    isLoadingTree,
    isLoadingEntry,
    showEntrySkeleton,
    searchQuery,
    error,
    copyBuffer,
    filteredTree,
    hasEntries,
    loadTree,
    selectEntry,
    clearSelection,
    refresh,
    insertEntry,
    generateEntry,
    removeEntry,
    moveEntry,
    duplicateEntry,
    editEntry,
    copyEntry,
    cutEntry,
    pasteEntry,
  };
});

export { useEntriesStore };
