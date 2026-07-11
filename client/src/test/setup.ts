import { vi } from "vitest";

/**
 * NeutralinoJS mock — covers all runtime exports used across the app.
 *
 * Mock strategy: `vi.mock("@neutralinojs/lib")` at module level.
 * This setup file is applied globally via `setupFiles` in vitest.config.ts.
 *
 * Coverage:
 * - `init()` — standalone function (default export via `import Neutralino`)
 * - `os` — 8 used functions (execCommand, getEnv, getPath, showOpenDialog,
 *   showSaveDialog, showFolderDialog, showNotification, showMessageBox)
 * - `filesystem` — 11 used functions (createDirectory, writeFile, readFile,
 *   getNormalizedPath, getJoinedPath, getPathParts, getRelativePath,
 *   readDirectory, getStats, createWatcher, removeWatcher)
 * - `debug` — `.log` function
 * - `clipboard` — 3 used functions (readText, writeText, clear)
 * - `events` — 2 used functions (on, off)
 * - Enums referenced as types (OperatingSystem, Icon, MessageBoxChoice, etc.)
 * - Extra namespace stubs (app, computer, storage, etc.) to prevent errors
 *   if any test accesses them
 *
 * Gotchas:
 * - `init()` is a `vi.fn()` no-op (prevents real WebSocket connection)
 * - `window.NL_OS` is mocked separately (it's a global, not from the module)
 * - Error shape: `{ code: ErrorCode, message: string }`
 * - `filesystem.getJoinedPath()` and `filesystem.getRelativePath()`
 *   are called without `wrapAsync` — must return sensible values.
 */

const { createMockNeu } = vi.hoisted(() => {
  const defaultExecCommandResult = {
    pid: 12345,
    stdOut: "",
    stdErr: "",
    exitCode: 0,
  };

  function createMockNeu() {
    const os = {
      execCommand: vi.fn(() => Promise.resolve({ ...defaultExecCommandResult })),
      getEnv: vi.fn(() => Promise.resolve("")),
      getEnvs: vi.fn(() => Promise.resolve({})),
      getLocale: vi.fn(() =>
        Promise.resolve({ locale: "en_US", language: "en", region: "US" })
      ),
      getPath: vi.fn(() => Promise.resolve("/home/user")),
      getSpawnedProcesses: vi.fn(() => Promise.resolve([])),
      open: vi.fn(() => Promise.resolve()),
      setTray: vi.fn(() => Promise.resolve()),
      showFolderDialog: vi.fn(() => Promise.resolve("")),
      showMessageBox: vi.fn(() => Promise.resolve("OK")),
      showNotification: vi.fn(() => Promise.resolve()),
      showOpenDialog: vi.fn(() => Promise.resolve([])),
      showSaveDialog: vi.fn(() => Promise.resolve("")),
      spawnProcess: vi.fn(() => Promise.resolve({ id: 1, pid: 12345 })),
      trashItem: vi.fn(() => Promise.resolve("")),
      updateSpawnedProcess: vi.fn(() => Promise.resolve()),
    };

    const filesystem = {
      createDirectory: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
      writeFile: vi.fn(() => Promise.resolve()),
      appendFile: vi.fn(() => Promise.resolve()),
      writeBinaryFile: vi.fn(() => Promise.resolve()),
      appendBinaryFile: vi.fn(() => Promise.resolve()),
      readFile: vi.fn(() => Promise.resolve("")),
      readBinaryFile: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      openFile: vi.fn(() => Promise.resolve(1)),
      createWatcher: vi.fn(() => Promise.resolve(42)),
      removeWatcher: vi.fn(() => Promise.resolve(42)),
      getWatchers: vi.fn(() => Promise.resolve([])),
      updateOpenedFile: vi.fn(() => Promise.resolve()),
      getOpenedFileInfo: vi.fn(() =>
        Promise.resolve({ id: 1, eof: false, pos: 0, lastRead: 0 })
      ),
      readDirectory: vi.fn(() => Promise.resolve([])),
      copy: vi.fn(() => Promise.resolve()),
      move: vi.fn(() => Promise.resolve()),
      getStats: vi.fn(() =>
        Promise.resolve({
          size: 0,
          isFile: true,
          isDirectory: false,
          createdAt: 0,
          modifiedAt: 0,
        })
      ),
      getAbsolutePath: vi.fn((p: string) => Promise.resolve(p)),
      getRelativePath: vi.fn((p: string) => Promise.resolve(p)),
      getPathParts: vi.fn(() =>
        Promise.resolve({
          rootName: "",
          rootDirectory: "",
          rootPath: "",
          relativePath: "",
          parentPath: "",
          filename: "",
          stem: "",
          extension: "",
        })
      ),
      getPermissions: vi.fn(() =>
        Promise.resolve({
          all: false,
          ownerAll: false,
          ownerRead: false,
          ownerWrite: false,
          ownerExec: false,
          groupAll: false,
          groupRead: false,
          groupWrite: false,
          groupExec: false,
          othersAll: false,
          othersRead: false,
          othersWrite: false,
          othersExec: false,
        })
      ),
      setPermissions: vi.fn(() => Promise.resolve()),
      getJoinedPath: vi.fn((...paths: string[]) =>
        Promise.resolve(paths.join("/"))
      ),
      getNormalizedPath: vi.fn((p: string) => Promise.resolve(p)),
      getUnnormalizedPath: vi.fn((p: string) => Promise.resolve(p)),
      access: vi.fn(() => Promise.resolve("")),
      chmod: vi.fn(() => Promise.resolve("")),
      chown: vi.fn(() => Promise.resolve("")),
    };

    const debug = {
      log: vi.fn(() => Promise.resolve()),
    };

    const clipboard = {
      getFormat: vi.fn(() => Promise.resolve("text")),
      readText: vi.fn(() => Promise.resolve("")),
      readImage: vi.fn(() => Promise.resolve(null)),
      writeText: vi.fn(() => Promise.resolve()),
      writeImage: vi.fn(() => Promise.resolve()),
      readHTML: vi.fn(() => Promise.resolve("")),
      writeHTML: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve()),
    };

    const events = {
      on: vi.fn(() =>
        Promise.resolve({ success: true, message: "ok" })
      ),
      off: vi.fn(() =>
        Promise.resolve({ success: true, message: "ok" })
      ),
      dispatch: vi.fn(() =>
        Promise.resolve({ success: true, message: "ok" })
      ),
      broadcast: vi.fn(() => Promise.resolve()),
    };

    const init = vi.fn();

    const app = {
      broadcast: vi.fn(),
      exit: vi.fn(),
      getConfig: vi.fn(),
      getProcessId: vi.fn(),
      killProcess: vi.fn(),
      readProcessInput: vi.fn(),
      restartProcess: vi.fn(),
      writeProcessError: vi.fn(),
      writeProcessOutput: vi.fn(),
    };

    const computer = {
      getArch: vi.fn(),
      getCPUInfo: vi.fn(),
      getDisplays: vi.fn(),
      getHostname: vi.fn(),
      getKernelInfo: vi.fn(),
      getMemoryInfo: vi.fn(),
      getMousePosition: vi.fn(),
      getNetworkInterfaces: vi.fn(),
      getOSInfo: vi.fn(),
      sendKey: vi.fn(),
      setMouseGrabbing: vi.fn(),
      setMousePosition: vi.fn(),
    };

    const storage = {
      clear: vi.fn(),
      getData: vi.fn(),
      getKeys: vi.fn(),
      removeData: vi.fn(),
      setData: vi.fn(),
    };

    const resources = {
      extractDirectory: vi.fn(),
      extractFile: vi.fn(),
      getFiles: vi.fn(),
      getStats: vi.fn(),
      readBinaryFile: vi.fn(),
      readFile: vi.fn(),
    };

    const server = {
      getMounts: vi.fn(),
      mount: vi.fn(),
      unmount: vi.fn(),
    };

    const updater = {
      checkForUpdates: vi.fn(),
      install: vi.fn(),
    };

    const custom = {
      getMethods: vi.fn(),
    };

    const mockNeutralino = {
      init,
      os,
      filesystem,
      debug,
      clipboard,
      events,
      app,
      computer,
      storage,
      resources,
      server,
      updater,
      custom,
      OperatingSystem: {
        Linux: "Linux",
        Windows: "Windows",
        Darwin: "Darwin",
        FreeBSD: "FreeBSD",
        Unknown: "Unknown",
      },
      Icon: {
        WARNING: "WARNING",
        ERROR: "ERROR",
        INFO: "INFO",
        QUESTION: "QUESTION",
      },
      MessageBoxChoice: {
        OK: "OK",
        OK_CANCEL: "OK_CANCEL",
        YES_NO: "YES_NO",
        YES_NO_CANCEL: "YES_NO_CANCEL",
        RETRY_CANCEL: "RETRY_CANCEL",
        ABORT_RETRY_IGNORE: "ABORT_RETRY_IGNORE",
      },
      LoggerType: {
        WARNING: "WARNING",
        ERROR: "ERROR",
        INFO: "INFO",
        DEBUG: "DEBUG",
      },
      ClipboardFormat: {
        unknown: "unknown",
        text: "text",
        image: "image",
      },
    };

    return {
      default: mockNeutralino,
      init,
      os,
      filesystem,
      debug,
      clipboard,
      events,
      app,
      computer,
      storage,
      resources,
      server,
      updater,
      custom,
      OperatingSystem: mockNeutralino.OperatingSystem,
      Icon: mockNeutralino.Icon,
      MessageBoxChoice: mockNeutralino.MessageBoxChoice,
      LoggerType: mockNeutralino.LoggerType,
      ClipboardFormat: mockNeutralino.ClipboardFormat,
    };
  }

  return { createMockNeu };
});

vi.mock("@neutralinojs/lib", () => createMockNeu());

Object.defineProperty(globalThis, "NL_OS", {
  value: "Linux",
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "NL_HOME_DIR", {
  value: "/home/user",
  writable: true,
  configurable: true,
});

(globalThis as Record<string, unknown>).__NEU_MOCK__ = true;
