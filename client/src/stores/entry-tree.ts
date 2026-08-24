import { Err, Ok, type Result } from "lib-result";
import { defineStore } from "pinia";
import { computed, readonly, ref, watch } from "vue";
import { Logger } from "@/lib/logger";
import type { SortMode } from "@/lib/tree-state";
import {
  Entries,
  EntriesReadError,
  type EntriesWriteError,
} from "@/services/entries";
import type { FsMkdirError } from "@/services/filesystem";
import { Fs } from "@/services/filesystem";
import { Pass } from "@/services/pass";
import { Watcher } from "@/services/watcher";
import { useActiveStoreStore } from "@/stores/active-store";
import type { EntryDetail, EntryTree, MutationResult } from "@/types/entries";

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
    } else {
      // Segment-boundary aware rewrite: exact match, or selection strictly
      // inside the moved directory. Slice (not replace) so `$` in newPath
      // is never interpreted as a replacement pattern.
      const sel = selectedPath.value;
      if (sel === oldPath) {
        selectedPath.value = newPath;
      } else if (sel?.startsWith(`${oldPath}/`)) {
        selectedPath.value = `${newPath}${sel.slice(oldPath.length)}`;
      }
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

    let fullPath: string;
    if (folderPath) {
      const joined = await Fs.join(storeDir, folderPath);
      if (joined.isError()) {
        error.value = joined.error;
        return Err(joined.error);
      }
      fullPath = joined.ok;
    } else {
      fullPath = storeDir;
    }

    const result = await Fs.mkdir(fullPath);
    if (result.isError()) {
      error.value = result.error;
      return result;
    }

    await refresh();
    return result;
  }

  // --- Copy / cut / paste buffer ---

  function copyEntry(path: string, nodeType?: CopyBuffer["nodeType"]): void {
    buffer.value = { path, mode: "copy", nodeType: nodeType ?? "FILE" };
  }

  function cutEntry(path: string, nodeType?: CopyBuffer["nodeType"]): void {
    buffer.value = { path, mode: "cut", nodeType: nodeType ?? "FILE" };
  }

  /**
   * Pastes the buffered entry into `destinationDir` ("" for root).
   * Returns `undefined` when the buffer is empty — callers only paste
   * when a buffer exists, so there is nothing to report.
   */
  async function pasteEntry(
    destinationDir: string
  ): Promise<
    Result<MutationResult, EntriesReadError | EntriesWriteError> | undefined
  > {
    if (!buffer.value) return;

    const { path: sourcePath, mode, nodeType } = buffer.value;
    const parts = await Fs.getPathParts(sourcePath);
    if (parts.isError()) {
      return Err(
        new EntriesReadError(
          sourcePath,
          "failed",
          `Failed to resolve source path: ${parts.error.message}`,
          parts.error
        )
      );
    }
    const fileName = parts.ok.filename;
    let destPath: string;
    if (destinationDir) {
      const joined = await Fs.join(destinationDir, fileName);
      if (joined.isError()) {
        return Err(
          new EntriesReadError(
            sourcePath,
            "failed",
            `Failed to resolve destination path: ${joined.error.message}`,
            joined.error
          )
        );
      }
      destPath = joined.ok;
    } else {
      destPath = fileName;
    }

    const result =
      mode === "copy"
        ? await duplicateEntry(sourcePath, destPath)
        : await moveEntry(sourcePath, destPath, nodeType);

    // Clear only on success — a failed paste keeps the buffer so the
    // user can retry instead of losing their cut/copy state.
    if (result.isOk()) {
      buffer.value = null;
    }

    return result;
  }

  function setSortMode(mode: SortMode): void {
    sortMode.value = mode;
  }

  // --- External-change polling ---

  // Polls the active store's `.gpg-id`: when it changes on disk (recipients
  // edited externally), refreshes the tree every 2s. Lives in the store so
  // it is an app-scoped singleton — re-arming clears the previous timer,
  // so repeated triggers (store switches, remounts) never double-poll.
  let watchTimer: ReturnType<typeof setInterval> | null = null;

  async function startStoreWatcher(): Promise<void> {
    const storeDir = Pass.storePath;
    if (storeDir) {
      const armed = await Watcher.watch("store", storeDir, ".gpg-id");
      if (armed.isError()) {
        await Logger.error(
          `entry-tree.startStoreWatcher: arming failed: ${armed.error.message}`
        );
      }
    }
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = setInterval(() => {
      if (Watcher.hasChanged("store")) {
        void refresh();
      }
    }, 2000);
  }

  // Re-arm on active-store switches. Keyed off the reactive ref —
  // Pass.storePath is a plain class property and would never re-fire.
  const activeStore = useActiveStoreStore();
  watch(
    () => activeStore.storePath,
    () => {
      void startStoreWatcher();
    },
    { immediate: true }
  );

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

export type { CopyBuffer };
export { useEntryTreeStore };
