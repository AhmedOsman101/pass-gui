import { createTestingPinia } from "@pinia/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/filesystem", () => ({
  Fs: { join: vi.fn((...p: string[]) => Promise.resolve(p.join("/"))) },
}));
vi.mock("@/services/pass", () => ({
  Pass: { storePath: "/home/user/.password-store" },
}));

import { useEntryTreeStore } from "@/stores/entry-tree";
import { useClipboardBuffer } from "../use-clipboard-buffer";

describe("useClipboardBuffer", () => {
  beforeEach(() => {
    createTestingPinia({ createSpy: vi.fn });
    vi.clearAllMocks();
  });

  it("copyEntry sets buffer with mode 'copy'", () => {
    const { copyEntry, buffer } = useClipboardBuffer();
    copyEntry("Email/work.gpg");
    expect(buffer.value).toEqual({
      path: "Email/work.gpg",
      mode: "copy",
      nodeType: "FILE",
    });
  });

  it("copyEntry with nodeType 'DIRECTORY'", () => {
    const { copyEntry, buffer } = useClipboardBuffer();
    copyEntry("Email", "DIRECTORY");
    expect(buffer.value).toEqual({
      path: "Email",
      mode: "copy",
      nodeType: "DIRECTORY",
    });
  });

  it("cutEntry sets buffer with mode 'cut'", () => {
    const { cutEntry, buffer } = useClipboardBuffer();
    cutEntry("Email/work.gpg");
    expect(buffer.value).toEqual({
      path: "Email/work.gpg",
      mode: "cut",
      nodeType: "FILE",
    });
  });

  it("cutEntry defaults to 'FILE' for nodeType", () => {
    const { cutEntry, buffer } = useClipboardBuffer();
    cutEntry("Social");
    expect(buffer.value).toEqual({
      path: "Social",
      mode: "cut",
      nodeType: "FILE",
    });
  });

  it("pasteEntry returns null when buffer is empty", async () => {
    const { pasteEntry } = useClipboardBuffer();
    const result = await pasteEntry("Social");
    expect(result).toBeNull();
  });

  it("pasteEntry dispatches duplicateEntry for copy mode", async () => {
    const { copyEntry, pasteEntry } = useClipboardBuffer();
    copyEntry("Email/work.gpg");
    await pasteEntry("Social");
    const treeStore = useEntryTreeStore();
    expect(treeStore.duplicateEntry).toHaveBeenCalledWith(
      "Email/work.gpg",
      "Social/work.gpg"
    );
  });

  it("pasteEntry dispatches moveEntry for cut mode", async () => {
    const { cutEntry, pasteEntry } = useClipboardBuffer();
    cutEntry("Email/work.gpg");
    await pasteEntry("Social");
    const treeStore = useEntryTreeStore();
    expect(treeStore.moveEntry).toHaveBeenCalledWith(
      "Email/work.gpg",
      "Social/work.gpg",
      "FILE"
    );
  });

  it("buffer is cleared before async operation", async () => {
    const { copyEntry, pasteEntry, buffer } = useClipboardBuffer();
    copyEntry("Email/work.gpg");
    expect(buffer.value).not.toBeNull();
    await pasteEntry("Social");
    expect(buffer.value).toBeNull();
  });

  it("pasteEntry joins destinationDir with filename", async () => {
    const { copyEntry, pasteEntry } = useClipboardBuffer();
    copyEntry("Email/work.gpg");
    await pasteEntry("Social/Sub");
    const treeStore = useEntryTreeStore();
    expect(treeStore.duplicateEntry).toHaveBeenCalledWith(
      "Email/work.gpg",
      "Social/Sub/work.gpg"
    );
  });
});
