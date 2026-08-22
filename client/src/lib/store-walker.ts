import { Err, Ok, type Result } from "lib-result";
import type { FsReadError, TreeDirectoryEntry } from "@/services/filesystem";
import { Fs } from "@/services/filesystem";
import type { EntryNode, EntryTree } from "@/types/entries";

/**
 * Default patterns for the ignore filter.
 * These are always applied when walking the store.
 * Will be extended in the future to support custom patterns
 * and .gitignore file reading.
 */
const DEFAULT_IGNORE = [".git", ".gpg-id"];

/**
 * Recursively filters a TreeDirectoryEntry[] to keep:
 * - .gpg files
 * - Directories that contain .gpg descendants
 * - Empty directories (newly created, no children yet)
 *
 * The ignore filter (DEFAULT_IGNORE) runs at the readDirectory level,
 * so .git and .gpg-id are already excluded before this runs.
 */
function filterGpgNodes(
  nodes: TreeDirectoryEntry[]
): TreeDirectoryEntry[] | null {
  const result: TreeDirectoryEntry[] = [];

  for (const node of nodes) {
    if (node.type === "FILE") {
      if (node.entry.endsWith(".gpg")) {
        result.push(node);
      }
      continue;
    }

    // Directory — keep if it has children with .gpg descendants
    if (node.children && node.children.length > 0) {
      const filtered = filterGpgNodes(node.children);
      if (filtered && filtered.length > 0) {
        result.push({ ...node, children: filtered });
      }
    } else {
      // Truly empty directory (no children at all)
      result.push({ ...node, children: undefined });
    }
  }

  return result.length > 0 ? result : null;
}

/**
 * Recursively converts filtered TreeDirectoryEntry nodes into EntryNode
 * domain types. Strips the .gpg extension from file names.
 */
function toEntryNodes(nodes: TreeDirectoryEntry[]): EntryNode[] {
  return nodes.map(node => {
    const isFile = node.type === "FILE";
    const name = isFile ? node.entry.replace(/\.gpg$/, "") : node.entry;

    return {
      name,
      path: isFile ? node.path.replace(/\.gpg$/, "") : node.path,
      type: node.type,
      children: node.children ? toEntryNodes(node.children) : undefined,
    };
  });
}

/**
 * Walks the password store directory and returns a tree of EntryNode[].
 *
 * Uses fs.readDirectory with recursive: true and DEFAULT_IGNORE patterns
 * to skip .git and .gpg-id, then filters to only .gpg files and
 * directories containing them, then converts to the domain EntryNode
 * type with .gpg extensions stripped.
 *
 * @example
 * ```ts
 * const result = await walkStore("/home/user/.password-store");
 * if (result.isOk()) {
 *   // result.ok is EntryTree — e.g.
 *   // [{ name: "Email", type: "DIRECTORY", children: [
 *   //    { name: "work", type: "FILE", path: "Email/work" }
 *   // ]}]
 * }
 * ```
 */
async function walkStore(
  storePath: string
): Promise<Result<EntryTree, FsReadError | Error>> {
  const tree = await Fs.readDirectory(storePath, {
    recursive: true,
    ignore: DEFAULT_IGNORE,
  });
  if (tree.isError()) return Err(tree.error);

  const filtered = filterGpgNodes(tree.ok);
  if (!filtered) return Ok([]);

  return Ok(toEntryNodes(filtered));
}

export { walkStore };
