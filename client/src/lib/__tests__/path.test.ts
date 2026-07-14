import { os } from "@neutralinojs/lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Path from "../path";

describe("expandTilde", () => {
  it("replaces tilde with home directory when followed by slash", () => {
    expect(Path.expandTilde("~/test", "/home/user")).toBe("/home/user/test");
  });

  it("replaces bare tilde with home directory", () => {
    expect(Path.expandTilde("~", "/home/user")).toBe("/home/user");
  });

  it("does not replace tilde in middle of path", () => {
    expect(Path.expandTilde("/foo/~", "/home/user")).toBe("/foo/~");
  });

  it("does not replace tilde not at start", () => {
    expect(Path.expandTilde("foo~bar/test", "/home/user")).toBe("foo~bar/test");
  });

  it("does not modify path without tilde", () => {
    expect(Path.expandTilde("/absolute/path", "/home/user")).toBe(
      "/absolute/path"
    );
  });
});

describe("resolveUserPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns path unchanged when no tilde", async () => {
    const result = await Path.resolveUserPath("/absolute/path");
    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/absolute/path");
  });

  it("expands tilde to home directory", async () => {
    const result = await Path.resolveUserPath("~/test");
    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/home/user/test");
  });
});

describe("getHomeDir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns home directory as Ok", async () => {
    const result = await Path.getHomeDir();
    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/home/user");
  });

  it("returns non-empty cached home dir on second call", async () => {
    const result = await Path.getHomeDir();
    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/home/user");
    expect(result.ok?.length).toBeGreaterThan(0);
  });
});

describe("getKnownPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns known path successfully", async () => {
    vi.mocked(os.getPath).mockResolvedValue("/home/user");
    const result = await Path.getKnownPath("home");
    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/home/user");
  });

  it("returns error when os.getPath throws", async () => {
    vi.mocked(os.getPath).mockRejectedValue(new Error("Native method failed"));
    const result = await Path.getKnownPath("home");
    expect(result.isError()).toBe(true);
  });
});
