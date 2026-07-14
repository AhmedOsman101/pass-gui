import {
  type FolderDialogOptions,
  type Icon,
  type MessageBoxChoice,
  type OpenDialogOptions,
  os,
  type SaveDialogOptions,
} from "@neutralinojs/lib";
import { type Result, wrapAsync } from "lib-result";
import Path from "@/lib/path";

/**
 * Service wrapping Neutralino OS dialog and notification APIs.
 * Each method returns Result instead of throwing, following lib-result conventions.
 * Dialog methods inject the system root as `defaultPath` when the caller doesn't specify one.
 */
class Dialog {
  private static systemRoot: string = Path.getSystemRoot();

  /**
   * Shows a file open dialog. Returns selected file paths, or empty array on cancel.
   * Defaults to system root when no defaultPath is provided.
   */
  static async showOpenDialog(
    title?: string,
    options?: OpenDialogOptions
  ): Promise<Result<string[]>> {
    const opts: OpenDialogOptions = {
      defaultPath: Dialog.systemRoot,
      ...options,
    };
    return await wrapAsync(async () => os.showOpenDialog(title, opts));
  }

  /**
   * Shows a file save dialog. Returns selected path, or empty string on cancel.
   * Defaults to system root when no defaultPath is provided.
   */
  static async showSaveDialog(
    title?: string,
    options?: SaveDialogOptions
  ): Promise<Result<string>> {
    const opts: SaveDialogOptions = {
      defaultPath: Dialog.systemRoot,
      ...options,
    };
    return await wrapAsync(async () => os.showSaveDialog(title, opts));
  }

  /**
   * Shows a folder open dialog. Returns selected folder path, or empty string on cancel.
   * Defaults to system root when no defaultPath is provided.
   */
  static async showFolderDialog(
    title?: string,
    options?: FolderDialogOptions
  ): Promise<Result<string>> {
    const opts: FolderDialogOptions = {
      defaultPath: Dialog.systemRoot,
      ...options,
    };
    return await wrapAsync(async () => os.showFolderDialog(title, opts));
  }

  /**
   * Shows a native OS notification.
   */
  static async showNotification(
    title: string,
    content: string,
    icon?: Icon
  ): Promise<Result<void>> {
    return await wrapAsync(async () =>
      os.showNotification(title, content, icon)
    );
  }

  /**
   * Shows a native OS message box. Returns the user's choice (e.g. "YES", "NO", "OK").
   */
  static async showMessageBox(
    title: string,
    content: string,
    choice?: MessageBoxChoice,
    icon?: Icon
  ): Promise<Result<string>> {
    return await wrapAsync(async () =>
      os.showMessageBox(title, content, choice, icon)
    );
  }
}

export { Dialog };
