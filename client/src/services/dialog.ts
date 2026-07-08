import {
  type FolderDialogOptions,
  type Icon,
  type MessageBoxChoice,
  type OpenDialogOptions,
  os,
  type SaveDialogOptions,
} from "@neutralinojs/lib";
import { type Result, wrapAsync } from "lib-result";

/**
 * Service wrapping Neutralino OS dialog and notification APIs.
 * Each method returns Result instead of throwing, following lib-result conventions.
 */
class DialogService {
  /**
   * Shows a file open dialog. Returns selected file paths, or empty array on cancel.
   */
  async showOpenDialog(
    title?: string,
    options?: OpenDialogOptions
  ): Promise<Result<string[]>> {
    return await wrapAsync(async () => os.showOpenDialog(title, options));
  }

  /**
   * Shows a file save dialog. Returns selected path, or empty string on cancel.
   */
  async showSaveDialog(
    title?: string,
    options?: SaveDialogOptions
  ): Promise<Result<string>> {
    return await wrapAsync(async () => os.showSaveDialog(title, options));
  }

  /**
   * Shows a folder open dialog. Returns selected folder path, or empty string on cancel.
   */
  async showFolderDialog(
    title?: string,
    options?: FolderDialogOptions
  ): Promise<Result<string>> {
    return await wrapAsync(async () => os.showFolderDialog(title, options));
  }

  /**
   * Shows a native OS notification.
   */
  async showNotification(
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
  async showMessageBox(
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

const Dialog = new DialogService();

export { Dialog, DialogService };
