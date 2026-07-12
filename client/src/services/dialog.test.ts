import { Icon, MessageBoxChoice, os } from "@neutralinojs/lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

describe("Dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("showOpenDialog", () => {
    it("returns selected file paths", async () => {
      vi.mocked(os.showOpenDialog).mockResolvedValue(["/path/to/file"]);
      const result = await Dialog.showOpenDialog("Select", { filters: [] });
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual(["/path/to/file"]);
    });

    it("wraps error when dialog throws", async () => {
      vi.mocked(os.showOpenDialog).mockRejectedValue(new Error("cancelled"));
      const result = await Dialog.showOpenDialog("Select");
      expect(result.isError()).toBe(true);
    });
  });

  describe("showSaveDialog", () => {
    it("returns selected save path", async () => {
      vi.mocked(os.showSaveDialog).mockResolvedValue("/path/to/save");
      const result = await Dialog.showSaveDialog("Save", {});
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("/path/to/save");
    });

    it("wraps error", async () => {
      vi.mocked(os.showSaveDialog).mockRejectedValue(new Error("cancelled"));
      const result = await Dialog.showSaveDialog("Save");
      expect(result.isError()).toBe(true);
    });
  });

  describe("showFolderDialog", () => {
    it("returns selected folder path", async () => {
      vi.mocked(os.showFolderDialog).mockResolvedValue("/path/to/folder");
      const result = await Dialog.showFolderDialog("Select folder");
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("/path/to/folder");
    });

    it("wraps error", async () => {
      vi.mocked(os.showFolderDialog).mockRejectedValue(new Error("cancelled"));
      const result = await Dialog.showFolderDialog("Select folder");
      expect(result.isError()).toBe(true);
    });
  });

  describe("showNotification", () => {
    it("shows notification", async () => {
      vi.mocked(os.showNotification).mockResolvedValue(undefined);
      const result = await Dialog.showNotification(
        "Title",
        "Content",
        Icon.INFO
      );
      expect(result.isOk()).toBe(true);
    });

    it("wraps error", async () => {
      vi.mocked(os.showNotification).mockRejectedValue(new Error("failed"));
      const result = await Dialog.showNotification(
        "Title",
        "Content",
        Icon.INFO
      );
      expect(result.isError()).toBe(true);
    });
  });

  describe("showMessageBox", () => {
    it("shows message box and returns choice", async () => {
      vi.mocked(os.showMessageBox).mockResolvedValue("YES");
      const result = await Dialog.showMessageBox(
        "Title",
        "Content",
        MessageBoxChoice.YES_NO,
        Icon.QUESTION
      );
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("YES");
    });

    it("wraps error", async () => {
      vi.mocked(os.showMessageBox).mockRejectedValue(new Error("cancelled"));
      const result = await Dialog.showMessageBox("Title", "Content");
      expect(result.isError()).toBe(true);
    });
  });
});
