import { createTestingPinia } from "@pinia/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

vi.mock("@/lib/tree-index", () => ({
  buildIndex: vi.fn(),
}));

vi.mock("@/lib/tree-state", () => ({
  buildVisible: vi.fn(),
  buildSearchResults: vi.fn(),
  toggleSet: vi.fn(),
}));

import { buildIndex } from "@/lib/tree-index";
import { buildSearchResults, buildVisible, toggleSet } from "@/lib/tree-state";
import { useEntryTreeStore } from "@/stores/entry-tree";
import type { TreeIndex, VisibleNode } from "@/types/entries";
import { useTreeState } from "../use-tree-state";

const rootIndex: TreeIndex = {
  byPath: new Map([
    [
      "Email",
      { name: "Email", path: "Email", type: "DIRECTORY", children: [] },
    ],
    ["Email/work", { name: "work", path: "Email/work", type: "FILE" }],
    [
      "Email/personal",
      { name: "personal", path: "Email/personal", type: "FILE" },
    ],
    [
      "Social",
      { name: "Social", path: "Social", type: "DIRECTORY", children: [] },
    ],
    [
      "Social/twitter",
      { name: "twitter", path: "Social/twitter", type: "FILE" },
    ],
  ]),
  parent: new Map([
    ["Email", null],
    ["Email/work", "Email"],
    ["Email/personal", "Email"],
    ["Social", null],
    ["Social/twitter", "Social"],
  ]),
  children: new Map([
    ["__root__", ["Email", "Social"]],
    ["Email", ["Email/work", "Email/personal"]],
    ["Social", ["Social/twitter"]],
  ]),
};

const defaultVisible: VisibleNode[] = [
  { path: "Email", depth: 0, isExpanded: false, isDirectory: true },
  { path: "Email/work", depth: 1, isExpanded: false, isDirectory: false },
  { path: "Email/personal", depth: 1, isExpanded: false, isDirectory: false },
  { path: "Social", depth: 0, isExpanded: false, isDirectory: true },
  { path: "Social/twitter", depth: 1, isExpanded: false, isDirectory: false },
];

describe("useTreeState", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.clearAllMocks();
    vi.mocked(buildIndex).mockReturnValue(rootIndex);
  });

  it("initializes visible nodes from tree store data", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { visibleNodes } = useTreeState();
    expect(visibleNodes.value).toBe(defaultVisible);
    expect(buildIndex).toHaveBeenCalled();
  });

  it("toggleDir expands a collapsed directory", () => {
    vi.mocked(toggleSet).mockImplementation((_idx, expanded, path) =>
      new Set(expanded).add(path)
    );
    const { toggleDir, expandedDirs } = useTreeState();
    toggleDir("Email");
    expect(expandedDirs.value.has("Email")).toBe(true);
  });

  it("toggleDir collapses an expanded directory", () => {
    vi.mocked(toggleSet).mockImplementation((_idx, expanded, path) => {
      const next = new Set(expanded);
      next.delete(path);
      return next;
    });
    const { toggleDir, expandedDirs } = useTreeState();
    expandedDirs.value = new Set(["Email"]);
    toggleDir("Email");
    expect(expandedDirs.value.has("Email")).toBe(false);
  });

  it("selectFile does nothing for unknown path", () => {
    const { selectFile } = useTreeState();
    const treeStore = useEntryTreeStore();
    selectFile("unknown/path");
    expect(treeStore.selectEntry).not.toHaveBeenCalled();
    expect(treeStore.setSelectedPath).not.toHaveBeenCalled();
  });

  it("selectFile calls treeStore.selectEntry for FILE type", () => {
    const { selectFile } = useTreeState();
    const treeStore = useEntryTreeStore();
    selectFile("Email/work");
    expect(treeStore.selectEntry).toHaveBeenCalledWith("Email/work");
    expect(treeStore.setSelectedPath).not.toHaveBeenCalled();
  });

  it("selectFile updates sidebar selection without loading DIRECTORY type", () => {
    const { selectFile } = useTreeState();
    const treeStore = useEntryTreeStore();
    treeStore.currentPath = "Email/work";
    selectFile("Email");
    expect(treeStore.setSelectedPath).toHaveBeenCalledWith("Email");
    expect(treeStore.selectEntry).not.toHaveBeenCalled();
    expect(treeStore.currentPath).toBe("Email/work");
  });

  it("toggleSelect toggles directory then selects for DIRECTORY type", () => {
    vi.mocked(toggleSet).mockImplementation((_idx, expanded, path) =>
      new Set(expanded).add(path)
    );
    const { toggleSelect, expandedDirs } = useTreeState();
    const treeStore = useEntryTreeStore();
    toggleSelect("Email");
    expect(expandedDirs.value.has("Email")).toBe(true);
    expect(treeStore.setSelectedPath).toHaveBeenCalledWith("Email");
    expect(treeStore.selectEntry).not.toHaveBeenCalled();
  });

  it("toggleSelect selects (no toggle) for FILE type", () => {
    const { toggleSelect, expandedDirs } = useTreeState();
    const treeStore = useEntryTreeStore();
    toggleSelect("Email/work");
    expect(expandedDirs.value.has("Email/work")).toBe(false);
    expect(treeStore.selectEntry).toHaveBeenCalledWith("Email/work");
    expect(treeStore.setSelectedPath).not.toHaveBeenCalled();
  });

  it("focusNext cycles forward through visible nodes", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { focusNext, focusedPath } = useTreeState();
    focusedPath.value = "Email";
    focusNext();
    expect(focusedPath.value).toBe("Email/work");
  });

  it("focusNext wraps around to first node", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { focusNext, focusedPath } = useTreeState();
    focusedPath.value = "Social/twitter";
    focusNext();
    expect(focusedPath.value).toBe("Email");
  });

  it("focusNext focuses first node when no focused path", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { focusNext, focusedPath } = useTreeState();
    expect(focusedPath.value).toBeNull();
    focusNext();
    expect(focusedPath.value).toBe("Email");
  });

  it("focusPrev cycles backward through visible nodes", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { focusPrev, focusedPath } = useTreeState();
    focusedPath.value = "Email/personal";
    focusPrev();
    expect(focusedPath.value).toBe("Email/work");
  });

  it("focusPrev wraps around to last node", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { focusPrev, focusedPath } = useTreeState();
    focusedPath.value = "Email";
    focusPrev();
    expect(focusedPath.value).toBe("Social/twitter");
  });

  it("focusPrev focuses last node when no focused path", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { focusPrev, focusedPath } = useTreeState();
    expect(focusedPath.value).toBeNull();
    focusPrev();
    expect(focusedPath.value).toBe("Social/twitter");
  });

  it("focusSelect calls selectFile for focused path", () => {
    const { focusSelect, focusedPath } = useTreeState();
    const treeStore = useEntryTreeStore();
    focusedPath.value = "Email/work";
    focusSelect();
    expect(treeStore.selectEntry).toHaveBeenCalledWith("Email/work");
  });

  it("focusSelect does nothing when focusedPath is null", () => {
    const { focusSelect } = useTreeState();
    const treeStore = useEntryTreeStore();
    focusSelect();
    expect(treeStore.selectEntry).not.toHaveBeenCalled();
    expect(treeStore.setSelectedPath).not.toHaveBeenCalled();
  });

  it("arrowRight expands a collapsed directory", () => {
    vi.mocked(toggleSet).mockImplementation((_idx, expanded, path) =>
      new Set(expanded).add(path)
    );
    const { arrowRight, focusedPath, expandedDirs } = useTreeState();
    focusedPath.value = "Email";
    arrowRight();
    expect(expandedDirs.value.has("Email")).toBe(true);
  });

  it("arrowRight moves to first child of an expanded directory", () => {
    const { arrowRight, focusedPath, expandedDirs } = useTreeState();
    expandedDirs.value = new Set(["Email"]);
    focusedPath.value = "Email";
    arrowRight();
    expect(focusedPath.value).toBe("Email/work");
  });

  it("arrowLeft collapses an expanded directory", () => {
    vi.mocked(toggleSet).mockImplementation((_idx, expanded, path) => {
      const next = new Set(expanded);
      next.delete(path);
      return next;
    });
    const { arrowLeft, focusedPath, expandedDirs } = useTreeState();
    expandedDirs.value = new Set(["Email"]);
    focusedPath.value = "Email";
    arrowLeft();
    expect(expandedDirs.value.has("Email")).toBe(false);
  });

  it("arrowLeft moves to parent of a collapsed node", () => {
    const { arrowLeft, focusedPath } = useTreeState();
    focusedPath.value = "Email/work";
    arrowLeft();
    expect(focusedPath.value).toBe("Email");
  });

  it("switches to search mode and uses buildSearchResults when searchQuery is non-empty", () => {
    const searchResults: VisibleNode[] = [
      {
        path: "Social/twitter",
        depth: 0,
        isExpanded: false,
        isDirectory: false,
      },
    ];
    vi.mocked(buildSearchResults).mockReturnValue(searchResults);
    const searchQuery = ref("twit");
    const { mode, visibleNodes } = useTreeState(searchQuery);
    expect(mode.value).toBe("search");
    expect(visibleNodes.value).toBe(searchResults);
    expect(buildSearchResults).toHaveBeenCalled();
  });

  it("stays in tree mode and uses buildVisible when searchQuery is empty", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const searchQuery = ref("");
    const { mode, visibleNodes } = useTreeState(searchQuery);
    expect(mode.value).toBe("tree");
    expect(visibleNodes.value).toBe(defaultVisible);
    expect(buildVisible).toHaveBeenCalled();
  });

  it("exposes selectedPath from treeStore.selectedPath", () => {
    vi.mocked(buildVisible).mockReturnValue(defaultVisible);
    const { selectedPath } = useTreeState();
    const treeStore = useEntryTreeStore();
    treeStore.selectedPath = "Email";
    treeStore.currentPath = "Email/work";
    expect(selectedPath.value).toBe("Email");

    treeStore.selectedPath = "Email/work";
    expect(selectedPath.value).toBe("Email/work");
  });
});
