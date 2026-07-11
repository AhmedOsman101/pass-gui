import { readonly, ref } from "vue";
import { Fs } from "@/services/filesystem";
import { useEntryTreeStore } from "@/stores/entry-tree";

type BufferMode = "copy" | "cut";

type CopyBuffer = {
  path: string;
  mode: BufferMode;
  nodeType: "FILE" | "DIRECTORY";
};

/**
 * Manages the in-memory copy/cut/paste buffer for tree operations.
 *
 * This is distinct from the system clipboard store (`useClipboardStore`)
 * which handles `pass show` → system clipboard → auto-clear.
 * This composable handles tree-level copy/cut/paste (used for
 * move and duplicate operations in the entry tree).
 */
function useClipboardBuffer() {
  const buffer = ref<CopyBuffer | null>(null);

  function copyEntry(path: string, nodeType?: "FILE" | "DIRECTORY"): void {
    buffer.value = { path, mode: "copy", nodeType: nodeType ?? "FILE" };
  }

  function cutEntry(path: string, nodeType?: "FILE" | "DIRECTORY"): void {
    buffer.value = { path, mode: "cut", nodeType: nodeType ?? "FILE" };
  }

  async function pasteEntry(destinationDir: string): Promise<string | null> {
    if (!buffer.value) return null;

    const { path: sourcePath, mode, nodeType } = buffer.value;
    const fileName = sourcePath.split("/").pop() as string;
    const destPath = destinationDir
      ? await Fs.join(destinationDir, fileName)
      : fileName;

    const treeStore = useEntryTreeStore();

    // Clear buffer before the async operation so the UI doesn't
    // show the buffer state while the paste is in flight
    buffer.value = null;

    if (mode === "copy") {
      return await treeStore.duplicateEntry(sourcePath, destPath);
    }
    return await treeStore.moveEntry(sourcePath, destPath, nodeType);
  }

  return {
    buffer: readonly(buffer),
    copyEntry,
    cutEntry,
    pasteEntry,
  };
}

export { useClipboardBuffer };
