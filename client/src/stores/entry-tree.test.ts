import { Err, Ok } from "lib-result";
import { createTestingPinia } from "@pinia/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/entries", () => ({
  Entries: {
    list: vi.fn(),
    show: vi.fn(),
    insert: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    copy: vi.fn(),
    edit: vi.fn(),
  },
}));
vi.mock("@/services/filesystem", () => ({
  Fs: {
    join: vi.fn((...p: string[]) => Promise.resolve(p.join("/"))),
    mkdir: vi.fn(),
  },
}));
vi.mock("@/services/pass", () => ({
  Pass: { storeDirectory: "/home/user/.password-store" },
}));

import { MutationError } from "@/lib/errors";
import { Entries } from "@/services/entries";
import { Fs } from "@/services/filesystem";
import { useEntryTreeStore } from "@/stores/entry-tree";

const mockTree = [
  {
    name: "Email",
    path: "Email",
    type: "DIRECTORY" as const,
    children: [
      { name: "work.gpg", path: "Email/work", type: "FILE" as const },
    ],
  },
  { name: "Social", path: "Social", type: "DIRECTORY" as const, children: [] },
];

const mockEntryDetail = {
  path: "Email/work",
  secret: "my-password",
  metadata: { username: "user" },
  other: [],
  raw: "my-password\nusername: user\n",
};

describe("entry-tree store", () => {
  beforeEach(() => {
    createTestingPinia({ stubActions: false, createSpy: vi.fn });
    vi.clearAllMocks();
  });

  it("has correct initial state", () => {
    const store = useEntryTreeStore();
    expect(store.tree).toEqual([]);
    expect(store.currentPath).toBeNull();
    expect(store.currentEntry).toBeNull();
    expect(store.isLoadingTree).toBe(false);
    expect(store.error).toBeNull();
    expect(store.sortMode).toBe("alphabetical");
    expect(store.hasEntries).toBe(false);
  });

  it("loadTree() sets tree and cycles isLoadingTree on success", async () => {
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    const store = useEntryTreeStore();

    const promise = store.loadTree();
    expect(store.isLoadingTree).toBe(true);
    await promise;

    expect(store.tree).toEqual(mockTree);
    expect(store.isLoadingTree).toBe(false);
    expect(store.error).toBeNull();
  });

  it("loadTree() sets error when Entries.list returns error", async () => {
    vi.mocked(Entries.list).mockResolvedValue(
      Err(new MutationError(1, "store walk error"))
    );
    const store = useEntryTreeStore();

    await store.loadTree();

    expect(store.error).toBeDefined();
    expect(store.error).toContain("store walk error");
    expect(store.tree).toEqual([]);
    expect(store.isLoadingTree).toBe(false);
  });

  it("loadTree() handles exception from Entries.list", async () => {
    vi.mocked(Entries.list).mockRejectedValue(new Error("unexpected crash"));
    const store = useEntryTreeStore();

    await store.loadTree();

    expect(store.error).toBe("unexpected crash");
    expect(store.isLoadingTree).toBe(false);
  });

  it("loadTree() handles non-Error thrown value", async () => {
    vi.mocked(Entries.list).mockRejectedValue("string error");
    const store = useEntryTreeStore();

    await store.loadTree();

    expect(store.error).toBe("string error");
    expect(store.isLoadingTree).toBe(false);
  });

  it("selectEntry() sets currentEntry on success", async () => {
    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    const store = useEntryTreeStore();

    await store.selectEntry("Email/work");

    expect(store.currentPath).toBe("Email/work");
    expect(store.currentEntry).toEqual(mockEntryDetail);
    expect(store.error).toBeNull();
  });

  it("selectEntry() with same path and force=false skips refetch", async () => {
    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    const store = useEntryTreeStore();

    await store.selectEntry("Email/work");
    vi.mocked(Entries.show).mockClear();

    await store.selectEntry("Email/work");

    expect(Entries.show).not.toHaveBeenCalled();
    expect(store.currentEntry).toEqual(mockEntryDetail);
  });

  it("selectEntry() with same path and force=true refetches", async () => {
    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    const store = useEntryTreeStore();

    await store.selectEntry("Email/work");
    vi.mocked(Entries.show).mockClear();

    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    await store.selectEntry("Email/work", true);

    expect(Entries.show).toHaveBeenCalledTimes(1);
    expect(store.currentEntry).toEqual(mockEntryDetail);
  });

  it("selectEntry() sets error and nulls currentEntry on error", async () => {
    vi.mocked(Entries.show).mockResolvedValue(
      Err(new MutationError(1, "not found"))
    );
    const store = useEntryTreeStore();

    await store.selectEntry("Email/missing");

    expect(store.error).toContain("not found");
    expect(store.currentEntry).toBeNull();
  });

  it("selectEntry() handles exception", async () => {
    vi.mocked(Entries.show).mockRejectedValue(new Error("show crash"));
    const store = useEntryTreeStore();

    await store.selectEntry("Email/work");

    expect(store.error).toBe("show crash");
    expect(store.currentEntry).toBeNull();
  });

  it("setCurrentPath() sets the path directly", () => {
    const store = useEntryTreeStore();

    store.setCurrentPath("Email/work");

    expect(store.currentPath).toBe("Email/work");
  });

  it("clearSelection() nulls both currentPath and currentEntry", () => {
    const store = useEntryTreeStore();
    store.currentPath = "Email/work";
    store.currentEntry = mockEntryDetail;

    store.clearSelection();

    expect(store.currentPath).toBeNull();
    expect(store.currentEntry).toBeNull();
  });

  it("refresh() calls loadTree() and populates tree", async () => {
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    const store = useEntryTreeStore();

    await store.refresh();

    expect(store.tree).toEqual(mockTree);
  });

  it("insertEntry() success returns null and selects entry", async () => {
    vi.mocked(Entries.insert).mockResolvedValue(
      Ok({ success: true, path: "Email/work" })
    );
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    const store = useEntryTreeStore();

    const result = await store.insertEntry("Email/work", "new-password");

    expect(result).toBeNull();
    expect(Entries.insert).toHaveBeenCalledWith({
      path: "Email/work",
      content: "new-password",
    });
    expect(store.error).toBeNull();
    expect(store.currentEntry).toEqual(mockEntryDetail);
  });

  it("insertEntry() error returns error message", async () => {
    vi.mocked(Entries.insert).mockResolvedValue(
      Err(new MutationError(1, "already exists"))
    );
    const store = useEntryTreeStore();

    const result = await store.insertEntry("Email/work", "new-password");

    expect(result).toBeDefined();
    expect(result).toContain("already exists");
    expect(store.error).toContain("already exists");
  });

  it("removeEntry() success clears selection and refreshes", async () => {
    vi.mocked(Entries.remove).mockResolvedValue(
      Ok({ success: true, path: "Email/work" })
    );
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    const store = useEntryTreeStore();
    store.currentPath = "Email/work";
    store.currentEntry = mockEntryDetail;

    const result = await store.removeEntry("Email/work");

    expect(result).toBeNull();
    expect(store.currentPath).toBeNull();
    expect(store.currentEntry).toBeNull();
    expect(store.tree).toEqual(mockTree);
  });

  it("removeEntry() error returns error message", async () => {
    vi.mocked(Entries.remove).mockResolvedValue(
      Err(new MutationError(1, "not found"))
    );
    const store = useEntryTreeStore();
    store.currentPath = "Email/work";
    store.currentEntry = mockEntryDetail;

    const result = await store.removeEntry("Email/work");

    expect(result).toContain("not found");
    expect(store.currentPath).toBe("Email/work");
    expect(store.currentEntry).toEqual(mockEntryDetail);
  });

  it("moveEntry() for FILE selects new path on success", async () => {
    vi.mocked(Entries.move).mockResolvedValue(
      Ok({ success: true, path: "Email/renamed", oldPath: "Email/work" })
    );
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    const store = useEntryTreeStore();

    const result = await store.moveEntry("Email/work", "Email/renamed", "FILE");

    expect(result).toBeNull();
    expect(Entries.move).toHaveBeenCalledWith("Email/work", "Email/renamed");
    expect(store.currentEntry).toEqual(mockEntryDetail);
  });

  it("moveEntry() for DIRECTORY does NOT select on success", async () => {
    vi.mocked(Entries.move).mockResolvedValue(
      Ok({
        success: true,
        path: "Social/renamed",
        oldPath: "Social",
      })
    );
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    const store = useEntryTreeStore();

    const result = await store.moveEntry("Social", "Social/renamed", "DIRECTORY");

    expect(result).toBeNull();
    expect(Entries.show).not.toHaveBeenCalled();
  });

  it("moveEntry() error returns error message", async () => {
    vi.mocked(Entries.move).mockResolvedValue(
      Err(new MutationError(1, "source not found"))
    );
    const store = useEntryTreeStore();

    const result = await store.moveEntry("Email/work", "Email/renamed");

    expect(result).toContain("source not found");
    expect(store.error).toContain("source not found");
  });

  it("duplicateEntry() success copies and selects dest", async () => {
    vi.mocked(Entries.copy).mockResolvedValue(
      Ok({
        success: true,
        path: "Email/work-copy",
        oldPath: "Email/work",
      })
    );
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    const store = useEntryTreeStore();

    const result = await store.duplicateEntry("Email/work", "Email/work-copy");

    expect(result).toBeNull();
    expect(Entries.copy).toHaveBeenCalledWith("Email/work", "Email/work-copy");
    expect(store.currentEntry).toEqual(mockEntryDetail);
  });

  it("duplicateEntry() error returns error message", async () => {
    vi.mocked(Entries.copy).mockResolvedValue(
      Err(new MutationError(1, "already exists"))
    );
    const store = useEntryTreeStore();

    const result = await store.duplicateEntry("Email/work", "Email/work-copy");

    expect(result).toContain("already exists");
    expect(store.error).toContain("already exists");
  });

  it("editEntry() success edits and selects entry", async () => {
    vi.mocked(Entries.edit).mockResolvedValue(
      Ok({ success: true, path: "Email/work" })
    );
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    vi.mocked(Entries.show).mockResolvedValue(Ok(mockEntryDetail));
    const store = useEntryTreeStore();

    const result = await store.editEntry("Email/work", "updated-content");

    expect(result).toBeNull();
    expect(Entries.edit).toHaveBeenCalledWith("Email/work", "updated-content");
    expect(store.currentEntry).toEqual(mockEntryDetail);
  });

  it("editEntry() error returns error message", async () => {
    vi.mocked(Entries.edit).mockResolvedValue(
      Err(new MutationError(1, "not found"))
    );
    const store = useEntryTreeStore();

    const result = await store.editEntry("Email/work", "updated-content");

    expect(result).toContain("not found");
    expect(store.error).toContain("not found");
  });

  it("createFolder() joins path and calls Fs.mkdir then refreshes", async () => {
    vi.mocked(Fs.mkdir).mockResolvedValue(Ok(true));
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    const store = useEntryTreeStore();

    const result = await store.createFolder("NewFolder");

    expect(result).toBeNull();
    expect(Fs.join).toHaveBeenCalledWith(
      "/home/user/.password-store",
      "NewFolder"
    );
    expect(Fs.mkdir).toHaveBeenCalled();
    expect(store.tree).toEqual(mockTree);
  });

  it("createFolder() returns error when Fs.mkdir fails", async () => {
    vi.mocked(Fs.mkdir).mockResolvedValue(Err(new Error("mkdir failed")));
    const store = useEntryTreeStore();

    const result = await store.createFolder("BadFolder");

    expect(result).toBe("mkdir failed");
    expect(store.error).toBe("mkdir failed");
  });

  it("setSortMode() changes sort mode", () => {
    const store = useEntryTreeStore();

    expect(store.sortMode).toBe("alphabetical");

    store.setSortMode("reverse-alphabetical");

    expect(store.sortMode).toBe("reverse-alphabetical");
  });

  it("hasEntries is true when tree has items", async () => {
    vi.mocked(Entries.list).mockResolvedValue(Ok(mockTree));
    const store = useEntryTreeStore();

    expect(store.hasEntries).toBe(false);

    await store.loadTree();

    expect(store.hasEntries).toBe(true);
  });
});
