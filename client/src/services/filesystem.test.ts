import { filesystem } from "@neutralinojs/lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DirectoryCreationError, FileWriteError } from "@/lib/errors";
import { Fs, makeIgnoreFilter, type TreeDirectoryEntry } from "./filesystem";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(filesystem.createDirectory).mockResolvedValue(undefined);
  vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);
  vi.mocked(filesystem.readFile).mockResolvedValue("file content");
  vi.mocked(filesystem.readDirectory).mockResolvedValue([]);
  vi.mocked(filesystem.getStats).mockResolvedValue({
    size: 1024,
    isFile: true,
    isDirectory: false,
    createdAt: 1000,
    modifiedAt: 2000,
  });
  vi.mocked(filesystem.getNormalizedPath).mockResolvedValue("/resolved/path");
  vi.mocked(filesystem.getJoinedPath).mockImplementation((...paths: string[]) =>
    Promise.resolve(paths.join("/"))
  );
  vi.mocked(filesystem.getRelativePath).mockImplementation((p: string) =>
    Promise.resolve(p)
  );
  vi.mocked(filesystem.getPathParts).mockResolvedValue({
    rootName: "",
    rootDirectory: "/",
    rootPath: "/",
    relativePath: "some/file.txt",
    parentPath: "/some",
    filename: "file.txt",
    stem: "file",
    extension: ".txt",
  });
});

describe("Fs.mkdir", () => {
  it("creates a directory successfully", async () => {
    const result = await Fs.mkdir("/some/path");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(filesystem.createDirectory).toHaveBeenCalledWith("/some/path");
  });

  it("returns DirectoryCreationError on NE_FS_DIRCRER", async () => {
    vi.mocked(filesystem.createDirectory).mockRejectedValue({
      code: "NE_FS_DIRCRER",
      message: "Directory creation failed",
    });

    const result = await Fs.mkdir("/some/path");

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(DirectoryCreationError);
    expect((result.error as DirectoryCreationError).path).toBe("/some/path");
    expect((result.error as DirectoryCreationError).code).toBe("NE_FS_DIRCRER");
  });

  it("returns unknown error on non-DirCre error code", async () => {
    vi.mocked(filesystem.createDirectory).mockRejectedValue({
      code: "NE_FS_FILWRER",
      message: "some other error",
    });

    const result = await Fs.mkdir("/some/path");

    expect(result.isError()).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error).not.toBeInstanceOf(DirectoryCreationError);
  });

  it("resolves tilde paths", async () => {
    vi.mocked(filesystem.createDirectory).mockResolvedValue(undefined);

    const result = await Fs.mkdir("~/test");

    expect(result.isOk()).toBe(true);
    expect(filesystem.createDirectory).toHaveBeenCalledWith(
      expect.stringContaining("/home/user/test")
    );
  });
});

describe("Fs.exists", () => {
  it("returns true when path is a file", async () => {
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: true,
      isDirectory: false,
      createdAt: 0,
      modifiedAt: 0,
    });

    const result = await Fs.exists("/some/file.gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns true when path is a directory", async () => {
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: false,
      isDirectory: true,
      createdAt: 0,
      modifiedAt: 0,
    });

    const result = await Fs.exists("/some/dir");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns false when path does not exist", async () => {
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: false,
      isDirectory: false,
      createdAt: 0,
      modifiedAt: 0,
    });

    const result = await Fs.exists("/nonexistent");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("returns error when getStats fails", async () => {
    vi.mocked(filesystem.getStats).mockRejectedValue({
      code: "NE_FS_NOPATHE",
      message: "Path not found",
    });

    const result = await Fs.exists("/some/path");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.isFile", () => {
  it("returns true when path is not a directory", async () => {
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: true,
      isDirectory: false,
      createdAt: 0,
      modifiedAt: 0,
    });

    const result = await Fs.isFile("/some/file.gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns false when path is a directory", async () => {
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: false,
      isDirectory: true,
      createdAt: 0,
      modifiedAt: 0,
    });

    const result = await Fs.isFile("/some/dir");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("returns error when getStats fails", async () => {
    vi.mocked(filesystem.getStats).mockRejectedValue({
      code: "NE_FS_NOPATHE",
      message: "Path not found",
    });

    const result = await Fs.isFile("/some/path");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.isDirectory", () => {
  it("returns true when path is a directory", async () => {
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: false,
      isDirectory: true,
      createdAt: 0,
      modifiedAt: 0,
    });

    const result = await Fs.isDirectory("/some/dir");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns false when path is a file", async () => {
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: true,
      isDirectory: false,
      createdAt: 0,
      modifiedAt: 0,
    });

    const result = await Fs.isDirectory("/some/file.gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("returns error when getStats fails", async () => {
    vi.mocked(filesystem.getStats).mockRejectedValue({
      code: "NE_FS_NOPATHE",
      message: "Path not found",
    });

    const result = await Fs.isDirectory("/some/path");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.getStats", () => {
  it("returns stats on success", async () => {
    const mockStats = {
      size: 2048,
      isFile: true,
      isDirectory: false,
      createdAt: 1000,
      modifiedAt: 2000,
    };
    vi.mocked(filesystem.getStats).mockResolvedValue(mockStats);

    const result = await Fs.getStats("/some/file.gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toEqual(mockStats);
  });

  it("returns error on failure", async () => {
    vi.mocked(filesystem.getStats).mockRejectedValue({
      code: "NE_FS_NOPATHE",
      message: "Path not found",
    });

    const result = await Fs.getStats("/some/path");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.readFile", () => {
  it("returns file contents on success", async () => {
    vi.mocked(filesystem.readFile).mockResolvedValue("password content");

    const result = await Fs.readFile("/some/file.gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("password content");
    expect(filesystem.readFile).toHaveBeenCalledWith(
      "/some/file.gpg",
      undefined
    );
  });

  it("passes options to filesystem.readFile", async () => {
    vi.mocked(filesystem.readFile).mockResolvedValue("partial content");

    const result = await Fs.readFile("/some/file.gpg", { pos: 0, size: 10 });

    expect(result.isOk()).toBe(true);
    expect(filesystem.readFile).toHaveBeenCalledWith("/some/file.gpg", {
      pos: 0,
      size: 10,
    });
  });

  it("returns error on failure", async () => {
    vi.mocked(filesystem.readFile).mockRejectedValue({
      code: "NE_FS_FILRDER",
      message: "File read failed",
    });

    const result = await Fs.readFile("/some/file.gpg");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.getNormalizedPath", () => {
  it("returns normalized path on success", async () => {
    vi.mocked(filesystem.getNormalizedPath).mockResolvedValue(
      "/resolved/some/path"
    );

    const result = await Fs.getNormalizedPath("/some/../path");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/resolved/some/path");
  });

  it("returns error on failure", async () => {
    vi.mocked(filesystem.getNormalizedPath).mockRejectedValue({
      code: "NE_FS_NOPATHE",
      message: "Path not found",
    });

    const result = await Fs.getNormalizedPath("/some/path");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.join", () => {
  it("joins path segments", async () => {
    const result = await Fs.join("/base", "sub", "file.gpg");

    expect(result).toBe("/base/sub/file.gpg");
    expect(filesystem.getJoinedPath).toHaveBeenCalledWith(
      "/base",
      "sub",
      "file.gpg"
    );
  });

  it("joins two segments", async () => {
    const result = await Fs.join("/store", "Email");

    expect(result).toBe("/store/Email");
  });
});

describe("Fs.getPathParts", () => {
  it("returns path parts on success", async () => {
    vi.mocked(filesystem.getPathParts).mockResolvedValue({
      rootName: "",
      rootDirectory: "/",
      rootPath: "/",
      relativePath: "some/file.txt",
      parentPath: "/some",
      filename: "file.txt",
      stem: "file",
      extension: ".txt",
    });

    const result = await Fs.getPathParts("/some/file.txt");

    expect(result.isOk()).toBe(true);
    expect(result.ok!.filename).toBe("file.txt");
    expect(result.ok!.extension).toBe(".txt");
  });

  it("returns error on failure", async () => {
    vi.mocked(filesystem.getPathParts).mockRejectedValue({
      code: "NE_FS_NOPATHE",
      message: "Path not found",
    });

    const result = await Fs.getPathParts("/invalid");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.relativePath", () => {
  it("returns relative path", async () => {
    vi.mocked(filesystem.getRelativePath).mockResolvedValue("Email/work.gpg");

    const result = await Fs.relativePath("/store/Email/work.gpg", "/store");

    expect(result).toBe("Email/work.gpg");
    expect(filesystem.getRelativePath).toHaveBeenCalledWith(
      "/store/Email/work.gpg",
      "/store"
    );
  });
});

describe("Fs.readDirectory", () => {
  const entries = [
    { entry: "Email", path: "/store/Email", type: "DIRECTORY" as const },
    {
      entry: "work.gpg",
      path: "/store/Email/work.gpg",
      type: "FILE" as const,
    },
    {
      entry: "personal.gpg",
      path: "/store/personal.gpg",
      type: "FILE" as const,
    },
  ];

  it("returns empty tree by default", async () => {
    const result = await Fs.readDirectory("/store");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toEqual([]);
  });

  it("returns flat array with flat: true", async () => {
    vi.mocked(filesystem.readDirectory).mockResolvedValue(entries);

    const result = await Fs.readDirectory("/store", {
      recursive: true,
      flat: true,
    });

    expect(result.isOk()).toBe(true);
    expect(result.ok as unknown[]).toHaveLength(3);
    expect(result.ok as unknown[]).toEqual(entries);
    expect(filesystem.readDirectory).toHaveBeenCalledWith("/store", {
      flat: true,
      recursive: true,
    });
  });

  it("returns tree with entries by default", async () => {
    vi.mocked(filesystem.readDirectory).mockResolvedValue(entries);

    const result = await Fs.readDirectory("/store", { recursive: true });

    expect(result.isOk()).toBe(true);
    const tree = result.ok as TreeDirectoryEntry[];
    expect(tree).toHaveLength(2);

    const emailDir = tree.find(n => n.entry === "Email");
    expect(emailDir).toBeDefined();
    expect(emailDir!.type).toBe("DIRECTORY");
    expect(emailDir!.path).toBe("Email");
    expect(emailDir!.children).toHaveLength(1);
    expect(emailDir!.children![0]!.entry).toBe("work.gpg");
    expect(emailDir!.children![0]!.path).toBe("Email/work.gpg");

    const personalFile = tree.find(n => n.entry === "personal.gpg");
    expect(personalFile).toBeDefined();
    expect(personalFile!.type).toBe("FILE");
    expect(personalFile!.path).toBe("personal.gpg");
    expect(personalFile!.children).toBeUndefined();
  });

  it("filters entries with ignore patterns", async () => {
    vi.mocked(filesystem.readDirectory).mockResolvedValue([
      { entry: "debug.log", path: "/store/debug.log", type: "FILE" as const },
      {
        entry: "work.gpg",
        path: "/store/work.gpg",
        type: "FILE" as const,
      },
    ]);

    const result = await Fs.readDirectory("/store", {
      recursive: true,
      flat: true,
      ignore: ["*.log"],
    });

    expect(result.isOk()).toBe(true);
    expect(result.ok as unknown[]).toHaveLength(1);
    expect((result.ok as Array<{ entry: string }>)[0]!.entry).toBe("work.gpg");
  });

  it("preserves non-matching entries with ignore patterns", async () => {
    vi.mocked(filesystem.readDirectory).mockResolvedValue([
      {
        entry: "work.gpg",
        path: "/store/work.gpg",
        type: "FILE" as const,
      },
      {
        entry: "personal.gpg",
        path: "/store/personal.gpg",
        type: "FILE" as const,
      },
    ]);

    const result = await Fs.readDirectory("/store", {
      recursive: true,
      flat: true,
      ignore: ["*.log"],
    });

    expect(result.isOk()).toBe(true);
    expect(result.ok).toHaveLength(2);
  });

  it("filters entries then builds tree with ignore patterns", async () => {
    vi.mocked(filesystem.readDirectory).mockResolvedValue([
      {
        entry: "temp",
        path: "/store/temp",
        type: "DIRECTORY" as const,
      },
      {
        entry: "notes.txt",
        path: "/store/temp/notes.txt",
        type: "FILE" as const,
      },
      {
        entry: "work.gpg",
        path: "/store/work.gpg",
        type: "FILE" as const,
      },
    ]);

    const result = await Fs.readDirectory("/store", {
      recursive: true,
      ignore: ["temp"],
    });

    expect(result.isOk()).toBe(true);
    const tree = result.ok as TreeDirectoryEntry[];
    expect(tree).toHaveLength(1);
    expect(tree[0]!.entry).toBe("work.gpg");
  });

  it("propagates errors", async () => {
    vi.mocked(filesystem.readDirectory).mockRejectedValue({
      code: "NE_FS_NOPATHE",
      message: "Path not found",
    });

    const result = await Fs.readDirectory("/nonexistent");

    expect(result.isError()).toBe(true);
  });
});

describe("Fs.writeFile", () => {
  it("writes file successfully", async () => {
    vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

    const result = await Fs.writeFile("/some/file.gpg", "password data");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(filesystem.writeFile).toHaveBeenCalledWith(
      "/some/file.gpg",
      "password data"
    );
  });

  it("returns FileWriteError on NE_FS_FILWRER", async () => {
    vi.mocked(filesystem.writeFile).mockRejectedValue({
      code: "NE_FS_FILWRER",
      message: "File write failed",
    });

    const result = await Fs.writeFile("/some/file.gpg", "data");

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(FileWriteError);
    expect((result.error as FileWriteError).path).toBe("/some/file.gpg");
    expect((result.error as FileWriteError).code).toBe("NE_FS_FILWRER");
  });

  it("returns unknown error on non-FILWRER error code", async () => {
    vi.mocked(filesystem.writeFile).mockRejectedValue({
      code: "NE_FS_DIRCRER",
      message: "some other error",
    });

    const result = await Fs.writeFile("/some/file.gpg", "data");

    expect(result.isError()).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error).not.toBeInstanceOf(FileWriteError);
  });

  it("resolves tilde paths", async () => {
    vi.mocked(filesystem.writeFile).mockResolvedValue(undefined);

    const result = await Fs.writeFile("~/test.gpg", "data");

    expect(result.isOk()).toBe(true);
    expect(filesystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("/home/user/test.gpg"),
      "data"
    );
  });
});

describe("makeIgnoreFilter", () => {
  beforeEach(() => {
    vi.mocked(filesystem.getRelativePath).mockImplementation(
      (absPath: string, base?: string) => {
        const prefix = base?.endsWith("/") ? base : `${base}/`;
        if (absPath.startsWith(prefix)) {
          return Promise.resolve(absPath.slice(prefix.length));
        }
        return Promise.resolve(absPath);
      }
    );
  });

  it("keeps non-matching entries", async () => {
    const keep = makeIgnoreFilter("/store", ["*.log"]);
    const result = await keep("/store/work.gpg");

    expect(result).toBe(true);
  });

  it("filters out matching entries", async () => {
    const keep = makeIgnoreFilter("/store", ["*.log"]);
    const result = await keep("/store/debug.log");

    expect(result).toBe(false);
  });

  it("filters entries in subdirectories with gitignore patterns", async () => {
    const keep = makeIgnoreFilter("/store", ["*.log"]);
    const result = await keep("/store/subdir/debug.log");

    expect(result).toBe(false);
  });

  it("caches relative path lookups", async () => {
    const keep = makeIgnoreFilter("/store", ["*.log"]);
    await keep("/store/debug.log");
    await keep("/store/debug.log");

    expect(filesystem.getRelativePath).toHaveBeenCalledTimes(1);
  });

  it("computes separate cache entries for different paths", async () => {
    const keep = makeIgnoreFilter("/store", ["*.log"]);
    await keep("/store/a.log");
    await keep("/store/b.log");

    expect(filesystem.getRelativePath).toHaveBeenCalledTimes(2);
  });
});
