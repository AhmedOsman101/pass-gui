import type { EntryNode, EntryTree, TreeIndex } from "@/types/entries";

export function buildIndex(tree: EntryTree): TreeIndex {
  const byPath = new Map<string, EntryNode>();
  const parent = new Map<string, string | null>();
  const children = new Map<string, string[]>();

  function walk(nodes: EntryTree, parentPath: string | null): void {
    for (const node of nodes) {
      byPath.set(node.path, node);
      parent.set(node.path, parentPath);

      const childPaths: string[] = node.children?.map(c => c.path) ?? [];
      children.set(node.path, childPaths);

      if (node.children) {
        walk(node.children, node.path);
      }
    }
  }

  children.set(
    "__root__",
    tree.map(n => n.path)
  );
  walk(tree, null);

  return { byPath, parent, children };
}
