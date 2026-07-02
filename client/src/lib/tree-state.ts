import type { TreeIndex, VisibleNode } from "@/types/entries";

type SortMode = "alphabetical" | "reverse-alphabetical";

function sortPaths(
  index: TreeIndex,
  paths: string[],
  sortMode?: SortMode
): string[] {
  if (!sortMode) return paths;

  const sorted = [...paths].sort((a, b) => {
    const nodeA = index.byPath.get(a);
    const nodeB = index.byPath.get(b);

    const aIsDir = nodeA?.type === "DIRECTORY";
    const bIsDir = nodeB?.type === "DIRECTORY";

    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;

    const nameA = nodeA?.name ?? a;
    const nameB = nodeB?.name ?? b;
    return sortMode === "alphabetical"
      ? nameA.localeCompare(nameB)
      : nameB.localeCompare(nameA);
  });

  return sorted;
}

export function buildVisible(
  index: TreeIndex,
  expandedDirs: Set<string>,
  sortMode?: SortMode
): VisibleNode[] {
  const result: VisibleNode[] = [];

  function walk(path: string, depth: number): void {
    const node = index.byPath.get(path);
    if (!node) return;

    const isDir = node.type === "DIRECTORY";
    const isExpanded = expandedDirs.has(path);

    result.push({ path, depth, isExpanded, isDirectory: isDir });

    if (isDir && isExpanded) {
      const childPaths = sortPaths(
        index,
        index.children.get(path) ?? [],
        sortMode
      );
      for (const childPath of childPaths) {
        walk(childPath, depth + 1);
      }
    }
  }

  const rootPaths = sortPaths(
    index,
    index.children.get("__root__") ?? [],
    sortMode
  );
  for (const rootPath of rootPaths) {
    walk(rootPath, 0);
  }

  return result;
}

export function buildSearchResults(
  index: TreeIndex,
  query: string
): VisibleNode[] {
  if (!query) return [];

  const q = query.toLowerCase();
  const toInclude = new Set<string>();

  for (const [path, node] of index.byPath) {
    if (node.name.toLowerCase().includes(q) || path.toLowerCase().includes(q)) {
      toInclude.add(path);
      let p = index.parent.get(path);
      while (p) {
        toInclude.add(p);
        p = index.parent.get(p);
      }
    }
  }

  const result: VisibleNode[] = [];

  function walk(path: string, depth: number): void {
    if (!toInclude.has(path)) return;

    const node = index.byPath.get(path);
    if (!node) return;

    const isDir = node.type === "DIRECTORY";
    const childPaths = index.children.get(path) ?? [];
    const hasMatchingChild = childPaths.some(c => toInclude.has(c));

    result.push({
      path,
      depth,
      isExpanded: isDir && hasMatchingChild,
      isDirectory: isDir,
    });

    if (hasMatchingChild) {
      for (const childPath of childPaths) {
        walk(childPath, depth + 1);
      }
    }
  }

  const rootPaths = index.children.get("__root__") ?? [];
  for (const rootPath of rootPaths) {
    walk(rootPath, 0);
  }

  return result;
}

export function expandSet(
  expandedDirs: Set<string>,
  path: string
): Set<string> {
  const next = new Set(expandedDirs);
  next.add(path);
  return next;
}

export function collapseSet(
  index: TreeIndex,
  expandedDirs: Set<string>,
  path: string
): Set<string> {
  const next = new Set(expandedDirs);

  function removeRec(p: string): void {
    next.delete(p);
    for (const child of index.children.get(p) ?? []) {
      removeRec(child);
    }
  }

  removeRec(path);
  return next;
}

export function toggleSet(
  index: TreeIndex,
  expandedDirs: Set<string>,
  path: string
): Set<string> {
  if (expandedDirs.has(path)) {
    return collapseSet(index, expandedDirs, path);
  }
  return expandSet(expandedDirs, path);
}
