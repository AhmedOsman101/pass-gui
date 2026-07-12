import { describe, expect, it } from "vitest";
import type { EntryTree } from "@/types/entries";
import { buildIndex } from "./tree-index";
import {
  buildSearchResults,
  buildVisible,
  collapseSet,
  expandSet,
  sortPaths,
  toggleSet,
} from "./tree-state";

const tree: EntryTree = [
  {
    name: "Email",
    path: "Email",
    type: "DIRECTORY",
    children: [
      { name: "work", path: "Email/work", type: "FILE" },
      { name: "personal", path: "Email/personal", type: "FILE" },
    ],
  },
  {
    name: "Social",
    path: "Social",
    type: "DIRECTORY",
    children: [{ name: "twitter", path: "Social/twitter", type: "FILE" }],
  },
  { name: "notes", path: "notes", type: "FILE" },
];

const index = buildIndex(tree);

describe("sortPaths", () => {
  it("sorts directories before files when both are at same level", () => {
    const paths = ["notes", "Email", "Social"];
    const result = sortPaths(index, paths, "alphabetical");
    expect(result).toEqual(["Email", "Social", "notes"]);
  });

  it("sorts alphabetically by name within the same type", () => {
    const result = sortPaths(index, ["Social", "Email"], "alphabetical");
    expect(result).toEqual(["Email", "Social"]);
  });

  it("sorts reverse-alphabetical with sortMode reverse-alphabetical", () => {
    const result = sortPaths(
      index,
      ["Social", "Email"],
      "reverse-alphabetical"
    );
    expect(result).toEqual(["Social", "Email"]);
  });

  it("returns paths in original order when sortMode is undefined", () => {
    const paths = ["notes", "Social", "Email"];
    const result = sortPaths(index, paths, undefined);
    expect(result).toEqual(["notes", "Social", "Email"]);
    expect(result).toBe(paths);
  });
});

describe("buildVisible", () => {
  it("returns empty array for empty TreeIndex", () => {
    const emptyIndex = buildIndex([]);
    expect(buildVisible(emptyIndex, new Set())).toEqual([]);
  });

  it("shows only root-level nodes when no dirs are expanded", () => {
    const result = buildVisible(index, new Set());
    expect(result).toEqual([
      { path: "Email", depth: 0, isExpanded: false, isDirectory: true },
      { path: "Social", depth: 0, isExpanded: false, isDirectory: true },
      { path: "notes", depth: 0, isExpanded: false, isDirectory: false },
    ]);
  });

  it("shows children at depth+1 when parent is expanded", () => {
    const result = buildVisible(index, new Set(["Email"]));
    expect(result).toEqual([
      { path: "Email", depth: 0, isExpanded: true, isDirectory: true },
      { path: "Email/work", depth: 1, isExpanded: false, isDirectory: false },
      {
        path: "Email/personal",
        depth: 1,
        isExpanded: false,
        isDirectory: false,
      },
      { path: "Social", depth: 0, isExpanded: false, isDirectory: true },
      { path: "notes", depth: 0, isExpanded: false, isDirectory: false },
    ]);
  });

  it("shows all nodes when multiple dirs are expanded", () => {
    const result = buildVisible(index, new Set(["Email", "Social"]));
    expect(result).toEqual([
      { path: "Email", depth: 0, isExpanded: true, isDirectory: true },
      { path: "Email/work", depth: 1, isExpanded: false, isDirectory: false },
      {
        path: "Email/personal",
        depth: 1,
        isExpanded: false,
        isDirectory: false,
      },
      { path: "Social", depth: 0, isExpanded: true, isDirectory: true },
      {
        path: "Social/twitter",
        depth: 1,
        isExpanded: false,
        isDirectory: false,
      },
      { path: "notes", depth: 0, isExpanded: false, isDirectory: false },
    ]);
  });

  it("sorts visible nodes alphabetically with sortMode", () => {
    const treeUnsorted: EntryTree = [
      {
        name: "ZZZ",
        path: "ZZZ",
        type: "DIRECTORY",
        children: [
          { name: "alpha", path: "ZZZ/alpha", type: "FILE" },
          { name: "beta", path: "ZZZ/beta", type: "FILE" },
        ],
      },
      {
        name: "AAA",
        path: "AAA",
        type: "DIRECTORY",
        children: [{ name: "delta", path: "AAA/delta", type: "FILE" }],
      },
    ];
    const ix = buildIndex(treeUnsorted);
    const result = buildVisible(ix, new Set(["AAA", "ZZZ"]), "alphabetical");
    expect(result).toEqual([
      { path: "AAA", depth: 0, isExpanded: true, isDirectory: true },
      { path: "AAA/delta", depth: 1, isExpanded: false, isDirectory: false },
      { path: "ZZZ", depth: 0, isExpanded: true, isDirectory: true },
      { path: "ZZZ/alpha", depth: 1, isExpanded: false, isDirectory: false },
      { path: "ZZZ/beta", depth: 1, isExpanded: false, isDirectory: false },
    ]);
  });

  it("expands deeply nested directories recursively", () => {
    const deepTree: EntryTree = [
      {
        name: "root",
        path: "root",
        type: "DIRECTORY",
        children: [
          {
            name: "mid",
            path: "root/mid",
            type: "DIRECTORY",
            children: [{ name: "leaf", path: "root/mid/leaf", type: "FILE" }],
          },
        ],
      },
    ];
    const ix = buildIndex(deepTree);
    const result = buildVisible(ix, new Set(["root", "root/mid"]));
    expect(result).toEqual([
      { path: "root", depth: 0, isExpanded: true, isDirectory: true },
      { path: "root/mid", depth: 1, isExpanded: true, isDirectory: true },
      {
        path: "root/mid/leaf",
        depth: 2,
        isExpanded: false,
        isDirectory: false,
      },
    ]);
  });
});

describe("buildSearchResults", () => {
  it("returns empty array for empty query", () => {
    expect(buildSearchResults(index, "")).toEqual([]);
  });

  it("finds nodes matching filename", () => {
    const result = buildSearchResults(index, "work");
    expect(result).toEqual([
      {
        path: "Email",
        depth: 0,
        isExpanded: true,
        isDirectory: true,
      },
      {
        path: "Email/work",
        depth: 1,
        isExpanded: false,
        isDirectory: false,
      },
    ]);
  });

  it("includes parent directories when a child matches", () => {
    const result = buildSearchResults(index, "twitter");
    expect(result).toEqual([
      {
        path: "Social",
        depth: 0,
        isExpanded: true,
        isDirectory: true,
      },
      {
        path: "Social/twitter",
        depth: 1,
        isExpanded: false,
        isDirectory: false,
      },
    ]);
  });

  it("matches partial query and includes parent dirs", () => {
    const result = buildSearchResults(index, "twit");
    expect(result).toEqual([
      {
        path: "Social",
        depth: 0,
        isExpanded: true,
        isDirectory: true,
      },
      {
        path: "Social/twitter",
        depth: 1,
        isExpanded: false,
        isDirectory: false,
      },
    ]);
  });

  it("matches directory names and includes their children", () => {
    const results = buildSearchResults(index, "Email");
    expect(results.some(n => n.path === "Email")).toBe(true);
    expect(results.some(n => n.path === "Email/work")).toBe(true);
    expect(results.some(n => n.path === "Email/personal")).toBe(true);
  });
});

describe("expandSet", () => {
  it("returns a new set with the path added", () => {
    const original = new Set<string>(["Social"]);
    const result = expandSet(original, "Email");
    expect(result.has("Email")).toBe(true);
    expect(result.has("Social")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("does not mutate the original set", () => {
    const original = new Set<string>(["Social"]);
    expandSet(original, "Email");
    expect(original.has("Email")).toBe(false);
    expect(original.size).toBe(1);
  });
});

describe("collapseSet", () => {
  it("removes the path and all children from the set", () => {
    const original = new Set<string>(["Email", "Email/work", "Email/personal"]);
    const result = collapseSet(index, original, "Email");
    expect(result.has("Email")).toBe(false);
    expect(result.has("Email/work")).toBe(false);
    expect(result.has("Email/personal")).toBe(false);
    expect(result.size).toBe(0);
  });

  it("recursively removes descendants of descendants", () => {
    const deepTree: EntryTree = [
      {
        name: "root",
        path: "root",
        type: "DIRECTORY",
        children: [
          {
            name: "sub",
            path: "root/sub",
            type: "DIRECTORY",
            children: [{ name: "leaf", path: "root/sub/leaf", type: "FILE" }],
          },
        ],
      },
    ];
    const ix = buildIndex(deepTree);
    const original = new Set<string>(["root", "root/sub", "root/sub/leaf"]);
    const result = collapseSet(ix, original, "root");
    expect(result.has("root")).toBe(false);
    expect(result.has("root/sub")).toBe(false);
    expect(result.has("root/sub/leaf")).toBe(false);
    expect(result.size).toBe(0);
  });

  it("does not remove unrelated paths", () => {
    const original = new Set<string>(["Email", "Social", "notes"]);
    const result = collapseSet(index, original, "Email");
    expect(result.has("Email")).toBe(false);
    expect(result.has("Social")).toBe(true);
    expect(result.has("notes")).toBe(true);
  });

  it("is no-op when path is not in the set", () => {
    const expanded = new Set(["Email"]);
    const result = collapseSet(index, expanded, "nonexistent");
    expect(result.has("Email")).toBe(true);
    expect(result.size).toBe(1);
  });
});

describe("toggleSet", () => {
  it("expands when the path is not currently expanded", () => {
    const original = new Set<string>();
    const result = toggleSet(index, original, "Email");
    expect(result.has("Email")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("collapses when the path is currently expanded", () => {
    const original = new Set<string>(["Email", "Email/work", "Email/personal"]);
    const result = toggleSet(index, original, "Email");
    expect(result.has("Email")).toBe(false);
    expect(result.has("Email/work")).toBe(false);
    expect(result.has("Email/personal")).toBe(false);
    expect(result.size).toBe(0);
  });
});
