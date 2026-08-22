import { defineStore } from "pinia";
import { Err, Ok, type Result } from "lib-result";
import { computed, readonly, ref } from "vue";
import { Entries } from "@/services/entries";
import type { EntriesReadError, EntriesWriteError } from "@/services/entries";
import { Fs } from "@/services/filesystem";
import type { FsMkdirError } from "@/services/filesystem";
import { Pass } from "@/services/pass";
import type {
  EntryDetail,
  EntryTree,
  MutationResult,
} from "@/types/entries";

type SortMode = "alphabetical" | "reverse-alphabetical";

/**
 * Tree-level copy/cut buffer entry. Distinct from the system-clipboard
 * store (`useClipboardStore`, pass show → clipboard → auto-clear): this
 * buffer drives copy/cut/paste of entries and folders inside the tree.
 */
type CopyBuffer = {
  path: string;
  mode: "copy" | "cut";
  nodeType: "FILE" | "DIRECTORY";
};

/**
 * Manages the password entry tree, current selection, sort mode,
 * the copy/cut/paste buffer, and all CRUD operations.
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
  const error = ref<Error | null>(null);
  const sortMode = ref<SortMode>("alphabetical");
  const buffer = ref<CopyBuffer | null>(null);

  const hasEntries = computed(() => tree.value.length > 0);

  async function loadTree(): Promise<Result<EntryTree, EntriesReadError>> {
    isLoadingTree.value = true;
    error.value = null;

    const result = await Entries.list();
    result
      .inspect(t => {
        tree.value = t;
      })
      .inspectErr(e => {
        error.value = e;
      });

    isLoadingTree.value = false;
    return result;
  }

  async function selectEntry(
    path: string,
    force = false
  ): Promise<Result<EntryDetail, EntriesReadError>> {
    selectedPath.value = path;
    if (!force && currentPath.value === path && currentEntry.value) {
      return Ok(currentEntry.value);
    }

    currentPath.value = path;
    error.value = null;

    const result = await Entries.show(path);
    result
      .inspect(detail => {
        currentEntry.value = detail;
      })
      .inspectErr(e => {
        error.value = e;
        currentEntry.value = null;
      });
    return result;
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
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    error.value = null;
    const result = await Entries.insert({ path, content });
    if (result.isError()) {
      error.value = result.error;
      return result;
    }
    await refresh();
    await selectEntry(path, true);
    return result;
  }

  async function removeEntry(
    path: string
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    error.value = null;
    const result = await Entries.remove(path);
    if (result.isError()) {
      error.value = result.error;
      return result;
    }
    clearSelection();
    await refresh();
    return result;
  }

  async function moveEntry(
    oldPath: string,
    newPath: string,
    nodeType?: "FILE" | "DIRECTORY"
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    error.value = null;
    const result = await Entries.move(oldPath, newPath);
    if (result.isError()) {
      error.value = result.error;
      return result;
    }
    await refresh();
    if (nodeType !== "DIRECTORY") {
      await selectEntry(newPath, true);
    } else if (selectedPath.value?.startsWith(`${oldPath}/`)) {
      selectedPath.value = selectedPath.value.replace(oldPath, newPath);
    } else if (selectedPath.value === oldPath) {
      selectedPath.value = newPath;
    }
    return result;
  }

  async function duplicateEntry(
    sourcePath: string,
    destPath: string
  ): Promise<Result<MutationResult, EntriesReadError | EntriesWriteError>> {
    error.value = null;
    const result = await Entries.copy(sourcePath, destPath);
    if (result.isError()) {
      error.value = result.error;
      return result;
    }
    await refresh();
    await selectEntry(destPath, true);
    return result;
  }

  async function editEntry(
    path: string,
    content: string
  ): Promise<Result<MutationResult, EntriesReadError | EntriesWriteError>> {
    error.value = null;
    const result = await Entries.edit(path, content);
    if (result.isError()) {
      error.value = result.error;
      return result;
    }
    await refresh();
    await selectEntry(path, true);
    return result;
  }

  async function createFolder(
    folderPath: string
  ): Promise<Result<boolean, FsMkdirError | Error>> {
    error.value = null;
    const storeDir = Pass.storePath;
    if (!storeDir) {
      return Err(new Error("No active store"));
    }

    const fullPath = folderPath
      ? await Fs.join(storeDir, folderPath)
      : storeDir;

    const result = await Fs.mkdir(fullPath);
    if (result.isError()) {
      error.value = result.error;
      return result;
    }

    await refresh();
    return result;
  }

  // --- Copy / cut / paste buffer ---

  function copyEntry(
    path: string,
    nodeType?: CopyBuffer["nodeType"]
  ): void {
    buffer.value = { path, mode: "copy", nodeType: nodeType ?? "FILE" };
  }

  function cutEntry(
    path: string,
    nodeType?: CopyBuffer["nodeType"]
  ): void {
    buffer.value = { path, mode: "cut", nodeType: nodeType ?? "FILE" };
  }

  /**
   * Pastes the buffered entry into `destinationDir` ("" for root).
   * Returns `undefined` when the buffer is empty — callers only paste
   * when a buffer exists, so there is nothing to report.
   */
  async function pasteEntry(destinationDir: string): Promise<
    Result<MutationResult, EntriesReadError | EntriesWriteError> | undefined
  > {
    if (!buffer.value) return undefined;

    const { path: sourcePath, mode, nodeType } = buffer.value;
    const fileName = sourcePath.split("/").pop() as string;
    const destPath = destinationDir
      ? await Fs.join(destinationDir, fileName)
      : fileName;

    // Clear buffer before the async operation so the UI doesn't
    // show the buffer state while the paste is in flight
    buffer.value = null;

    if (mode === "copy") {
      return duplicateEntry(sourcePath, destPath);
    }
    return moveEntry(sourcePath, destPath, nodeType);
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
    buffer: readonly(buffer),
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
    copyEntry,
    cutEntry,
    pasteEntry,
    setSortMode,
  };
});

export type { CopyBuffer, SortMode };
export { useEntryTreeStore };
