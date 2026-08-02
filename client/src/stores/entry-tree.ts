import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { Entries } from "@/services/entries";
import { Fs } from "@/services/filesystem";
import { Pass } from "@/services/pass";
import type { EntryDetail, EntryTree } from "@/types/entries";

type SortMode = "alphabetical" | "reverse-alphabetical";

/**
 * Manages the password entry tree, current selection, sort mode,
 * and all CRUD operations.
 *
 * Each CRUD action calls `refresh()` after success and calls
 * `selectEntry()` for non-directory mutations — same behaviour
 * as the monolithic store replaced by this module.
 */
const useEntryTreeStore = defineStore("entry-tree", () => {
  const tree = ref<EntryTree>([]);
  const selectedPath = ref<string | null>(null);
  const currentPath = ref<string | null>(null);
  const currentEntry = ref<EntryDetail | null>(null);
  const isLoadingTree = ref(false);
  const error = ref<string | null>(null);
  const sortMode = ref<SortMode>("alphabetical");

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

  async function selectEntry(path: string, force = false): Promise<void> {
    selectedPath.value = path;
    if (!force && currentPath.value === path && currentEntry.value) return;

    currentPath.value = path;
    error.value = null;

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
    }
  }

  function setSelectedPath(path: string): void {
    selectedPath.value = path;
  }

  function clearSelection(): void {
    selectedPath.value = null;
    currentPath.value = null;
    currentEntry.value = null;
  }

  async function refresh(): Promise<void> {
    await loadTree();
  }

  // --- Mutation actions ---

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
    await selectEntry(path, true);
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
    newPath: string,
    nodeType?: "FILE" | "DIRECTORY"
  ): Promise<string | null> {
    error.value = null;
    const result = await Entries.move(oldPath, newPath);
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }
    await refresh();
    if (nodeType !== "DIRECTORY") {
      await selectEntry(newPath, true);
    } else if (selectedPath.value?.startsWith(`${oldPath}/`)) {
      selectedPath.value = selectedPath.value.replace(oldPath, newPath);
    } else if (selectedPath.value === oldPath) {
      selectedPath.value = newPath;
    }
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
    await selectEntry(destPath, true);
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
    await refresh();
    await selectEntry(path, true);
    return null;
  }

  async function createFolder(folderPath: string): Promise<string | null> {
    error.value = null;
    const storeDir = Pass.storePath;
    if (!storeDir) {
      error.value = "No active store";
      return error.value;
    }

    const fullPath = folderPath
      ? await Fs.join(storeDir, folderPath)
      : storeDir;

    const result = await Fs.mkdir(fullPath);
    if (result.isError()) {
      const msg = result.error.message;
      error.value = msg;
      return msg;
    }

    await refresh();
    return null;
  }

  function setSortMode(mode: SortMode): void {
    sortMode.value = mode;
  }

  return {
    tree,
    selectedPath,
    currentPath,
    currentEntry,
    isLoadingTree,
    error,
    sortMode,
    hasEntries,
    loadTree,
    selectEntry,
    setSelectedPath,
    clearSelection,
    refresh,
    insertEntry,
    removeEntry,
    moveEntry,
    duplicateEntry,
    editEntry,
    createFolder,
    setSortMode,
  };
});

export type { SortMode };
export { useEntryTreeStore };
