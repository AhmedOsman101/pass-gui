import { Err, Ok, type Result } from "lib-result";
import type { TreeDirectoryEntry } from "@/services/filesystem";
import { Fs } from "@/services/filesystem";
import type { EntryNode, EntryTree } from "@/types/entries";
import type { MutationError } from "./errors";

/**
 * Recursively filters a TreeDirectoryEntry[] to keep only .gpg files
 * and directories that contain .gpg descendants. Returns null if a
 * directory has no .gpg descendants (prune it from the tree).
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

    // Directory — recurse and keep only if it has .gpg descendants
    if (node.children) {
      const filtered = filterGpgNodes(node.children);
      if (filtered && filtered.length > 0) {
        result.push({ ...node, children: filtered });
      }
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
 * Uses fs.readDirectory with recursive: true to get the full hierarchy,
 * filters to only .gpg files and directories containing them, then
 * converts to the domain EntryNode type with .gpg extensions stripped.
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
): Promise<Result<EntryTree, MutationError | Error>> {
  const tree = await Fs.readDirectory(storePath, { recursive: true });
  if (tree.isError()) return Err(tree.error);

  const filtered = filterGpgNodes(tree.ok);
  if (!filtered) return Ok([]);

  return Ok(toEntryNodes(filtered));
}

export { walkStore };
