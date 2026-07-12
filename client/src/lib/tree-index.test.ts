import { describe, expect, it } from "vitest";
import type { EntryTree } from "@/types/entries";
import { buildIndex } from "./tree-index";

describe("buildIndex", () => {
  it("returns empty maps for an empty tree", () => {
    const result = buildIndex([]);
    expect(result.byPath.size).toBe(0);
    expect(result.parent.size).toBe(0);
    expect(result.children.size).toBe(1);
    expect(result.children.get("__root__")).toEqual([]);
  });

  it("indexes a single FILE node", () => {
    const tree: EntryTree = [{ name: "secret", path: "secret", type: "FILE" }];
    const result = buildIndex(tree);
    expect(result.byPath.get("secret")?.name).toBe("secret");
    expect(result.parent.get("secret")).toBeNull();
    expect(result.children.get("secret")).toEqual([]);
  });

  it("indexes a flat list of root-level FILE nodes", () => {
    const tree: EntryTree = [
      { name: "a", path: "a", type: "FILE" },
      { name: "b", path: "b", type: "FILE" },
    ];
    const result = buildIndex(tree);
    expect(result.byPath.size).toBe(2);
    expect(result.parent.get("a")).toBeNull();
    expect(result.parent.get("b")).toBeNull();
    expect(result.children.get("__root__")).toEqual(["a", "b"]);
  });

  it("indexes a DIR with FILE children", () => {
    const tree: EntryTree = [
      {
        name: "dir",
        path: "dir",
        type: "DIRECTORY",
        children: [{ name: "f1", path: "dir/f1", type: "FILE" }],
      },
    ];
    const result = buildIndex(tree);
    expect(result.parent.get("dir/f1")).toBe("dir");
    expect(result.children.get("dir")).toEqual(["dir/f1"]);
  });

  it("indexes multiple levels of nesting", () => {
    const tree: EntryTree = [
      {
        name: "dir",
        path: "dir",
        type: "DIRECTORY",
        children: [
          {
            name: "sub",
            path: "dir/sub",
            type: "DIRECTORY",
            children: [{ name: "f1", path: "dir/sub/f1", type: "FILE" }],
          },
        ],
      },
    ];
    const result = buildIndex(tree);
    // Parent chain
    expect(result.parent.get("dir")).toBeNull();
    expect(result.parent.get("dir/sub")).toBe("dir");
    expect(result.parent.get("dir/sub/f1")).toBe("dir/sub");
    // Children map at each level
    expect(result.children.get("dir")).toEqual(["dir/sub"]);
    expect(result.children.get("dir/sub")).toEqual(["dir/sub/f1"]);
    expect(result.children.get("dir/sub/f1")).toEqual([]);
  });

  it("handles DIR node without children property", () => {
    const tree: EntryTree = [
      { name: "empty", path: "empty", type: "DIRECTORY" },
    ];
    const result = buildIndex(tree);
    expect(result.children.get("empty")).toEqual([]);
  });

  it("populates __root__ with all top-level entry paths", () => {
    const tree: EntryTree = [
      { name: "a", path: "a", type: "FILE" },
      {
        name: "dir",
        path: "dir",
        type: "DIRECTORY",
        children: [{ name: "b", path: "dir/b", type: "FILE" }],
      },
      { name: "c", path: "c", type: "FILE" },
    ];
    const result = buildIndex(tree);
    expect(result.children.get("__root__")).toEqual(["a", "dir", "c"]);
  });
});
