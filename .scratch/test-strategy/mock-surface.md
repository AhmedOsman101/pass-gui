# Mock Surface: `@neutralinojs/lib` v6.8.0

> Generated for Test Strategy ticket #15. Maps every import used across the
> pass-gui codebase to its exact type signature and recommends a shared mock
> factory for `vi.mock("@neutralinojs/lib")`.

## Module Format

`@neutralinojs/lib` is a **CJS** package (no `"type": "module"`, `"main": "./dist/index.js"`).
It also ships ESM at `./dist/neutralino.mjs` for bundlers that prefer it
(Vite resolves to the ESM build via the `.mjs` extension).

Vitest handles CJS/ESM interop transparently — `vi.mock()` with a factory
just needs to return the same export shape.

## All Imports (10 source files)

| File | Imports | Type |
|------|---------|------|
| `main.ts` | `Neutralino` (default) | runtime: calls `Neutralino.init()` |
| `services/neutralino.ts` | `debug`, `os`, `type ExecCommandOptions`, `type ExecCommandResult`, `type OperatingSystem` | runtime + type |
| `services/pass.ts` | `debug`, `type ExecCommandOptions`, `type ExecCommandResult` | runtime + type |
| `services/gpg.ts` | `debug`, `type ExecCommandOptions`, `type ExecCommandResult` | runtime + type |
| `services/filesystem.ts` | `filesystem`, `type DirectoryEntry`, `type DirectoryReaderOptions`, `type FileReaderOptions`, `type PathParts`, `type Stats` | runtime + type |
| `services/clipboard.ts` | `clipboard` (as `neuClipboard`) | runtime |
| `services/watcher.ts` | `events`, `filesystem` | runtime |
| `services/dialog.ts` | `os`, `type FolderDialogOptions`, `type Icon`, `type MessageBoxChoice`, `type OpenDialogOptions`, `type SaveDialogOptions` | runtime + type |
| `services/entries.ts` | `type ExecCommandResult` | type-only |
| `lib/path.ts` | `os`, `type KnownPath` | runtime + type |

> **Note:** `ExecCommandResult` in `entries.ts` is type-only (`import type`).
> It's erased at compile time — no mock entry needed for that import alone.
> But it's harmless and recommended to include in the factory for test files
> that may reference the type.

## Runtime Exports (what the mock MUST provide)

### `init()` — standalone function

Used via default import: `Neutralino.init()`.

```ts
// Type declaration
interface InitOptions {
  exportCustomMethods?: boolean;
}
declare function init(options?: InitOptions): void;
```

**Side effects on call:**
- Opens a WebSocket to `ws://127.0.0.1:<NL_PORT>?connectToken=<token>`
- Registers built-in event handlers (`ready`, `close`, `error`, etc.)
- Sets `window.NL_CVERSION` and `window.NL_CCOMMIT`
- If `exportCustomMethods: true`, wires up `Neutralino.custom.*` methods
- If `--neu-dev-auto-reload` arg present, sets up hot-reload listener

**Mock strategy:** `vi.fn()`. No-op by default. Individual tests that need to
verify init behavior can set up `mockResolvedValue` or `mockImplementation`.

---

### `os` — namespace object

```ts
declare namespace os {
  export function execCommand(
    command: string,
    options?: ExecCommandOptions
  ): Promise<ExecCommandResult>;

  export function getEnv(key: string): Promise<string>;
  export function getEnvs(): Promise<Envs>;
  export function getLocale(): Promise<LocaleInfo>;
  export function getPath(name: KnownPath): Promise<string>;
  export function getSpawnedProcesses(): Promise<SpawnedProcess[]>;
  export function open(url: string): Promise<void>;
  export function setTray(options: TrayOptions): Promise<void>;
  export function showFolderDialog(
    title?: string,
    options?: FolderDialogOptions
  ): Promise<string>;
  export function showMessageBox(
    title: string,
    content: string,
    choice?: MessageBoxChoice,
    icon?: Icon
  ): Promise<string>;
  export function showNotification(
    title: string,
    content: string,
    icon?: Icon
  ): Promise<void>;
  export function showOpenDialog(
    title?: string,
    options?: OpenDialogOptions
  ): Promise<string[]>;
  export function showSaveDialog(
    title?: string,
    options?: SaveDialogOptions
  ): Promise<string>;
  export function spawnProcess(
    command: string,
    options?: SpawnedProcessOptions
  ): Promise<SpawnedProcess>;
  export function trashItem(path: string): Promise<string>;
  export function updateSpawnedProcess(
    id: number,
    event: string,
    data?: any
  ): Promise<void>;
}
```

**Used in codebase:**
- `os.execCommand(cmd, opts)` — `services/neutralino.ts`
- `os.getEnv(key)` — `services/neutralino.ts`
- `os.getPath(name)` — `lib/path.ts`
- `os.showOpenDialog(title, opts)` — `services/dialog.ts`
- `os.showSaveDialog(title, opts)` — `services/dialog.ts`
- `os.showFolderDialog(title, opts)` — `services/dialog.ts`
- `os.showNotification(title, content, icon)` — `services/dialog.ts`
- `os.showMessageBox(title, content, choice, icon)` — `services/dialog.ts`

**Only the above 8 functions are actively used.** The rest can be `vi.fn()`
or omitted (Vitest throws on undefined exports only when they're accessed).

---

### `filesystem` — namespace object

```ts
declare namespace filesystem {
  export function createDirectory(path: string): Promise<void>;
  export function remove(path: string): Promise<void>;
  export function writeFile(path: string, data: string): Promise<void>;
  export function appendFile(path: string, data: string): Promise<void>;
  export function writeBinaryFile(
    path: string,
    data: ArrayBuffer
  ): Promise<void>;
  export function appendBinaryFile(
    path: string,
    data: ArrayBuffer
  ): Promise<void>;
  export function readFile(
    path: string,
    options?: FileReaderOptions
  ): Promise<string>;
  export function readBinaryFile(
    path: string,
    options?: FileReaderOptions
  ): Promise<ArrayBuffer>;
  export function openFile(path: string): Promise<number>;
  export function createWatcher(path: string): Promise<number>;
  export function removeWatcher(id: number): Promise<number>;
  export function getWatchers(): Promise<Watcher[]>;
  export function updateOpenedFile(
    id: number,
    event: string,
    data?: any
  ): Promise<void>;
  export function getOpenedFileInfo(id: number): Promise<OpenedFile>;
  export function readDirectory(
    path: string,
    options?: DirectoryReaderOptions
  ): Promise<DirectoryEntry[]>;
  export function copy(
    source: string,
    destination: string,
    options?: CopyOptions
  ): Promise<void>;
  export function move(source: string, destination: string): Promise<void>;
  export function getStats(path: string): Promise<Stats>;
  export function getAbsolutePath(path: string): Promise<string>;
  export function getRelativePath(
    path: string,
    base?: string
  ): Promise<string>;
  export function getPathParts(path: string): Promise<PathParts>;
  export function getPermissions(path: string): Promise<Permissions>;
  export function setPermissions(
    path: string,
    permissions: Permissions,
    mode: PermissionsMode
  ): Promise<void>;
  export function getJoinedPath(...paths: string[]): Promise<string>;
  export function getNormalizedPath(path: string): Promise<string>;
  export function getUnnormalizedPath(path: string): Promise<string>;
  export function access(path: string, mode?: number): Promise<string>;
  export function chmod(path: string, mode: number): Promise<string>;
  export function chown(
    path: string,
    uid: number,
    gid: number
  ): Promise<string>;
}
```

**Used in codebase:**
- `filesystem.createDirectory(path)` — `services/filesystem.ts` (in `mkdir`)
- `filesystem.writeFile(path, data)` — `services/filesystem.ts` (in `writeFile`)
- `filesystem.readFile(path, opts)` — `services/filesystem.ts` (in `readFile`)
- `filesystem.getNormalizedPath(path)` — `services/filesystem.ts`
- `filesystem.getJoinedPath(...paths)` — `services/filesystem.ts` (in `join`)
- `filesystem.getPathParts(path)` — `services/filesystem.ts`
- `filesystem.getRelativePath(path, base)` — `services/filesystem.ts`
- `filesystem.readDirectory(path, opts)` — `services/filesystem.ts`
- `filesystem.getStats(path)` — `services/filesystem.ts`
- `filesystem.createWatcher(path)` — `services/watcher.ts`
- `filesystem.removeWatcher(id)` — `services/watcher.ts`

**Only the above 11 functions are actively used.** The rest can be `vi.fn()`.

---

### `debug` — namespace object

```ts
declare namespace debug {
  export function log(
    message: string,
    type?: LoggerType
  ): Promise<void>;
}
```

**Used in codebase:**
- `debug.log(...)` — `services/neutralino.ts`, `services/pass.ts`, `services/gpg.ts`

---

### `clipboard` — namespace object

```ts
declare namespace clipboard {
  export function getFormat(): Promise<ClipboardFormat>;
  export function readText(): Promise<string>;
  export function readImage(format?: string): Promise<ClipboardImage | null>;
  export function writeText(data: string): Promise<void>;
  export function writeImage(image: ClipboardImage): Promise<void>;
  export function readHTML(): Promise<string>;
  export function writeHTML(data: string): Promise<void>;
  export function clear(): Promise<void>;
}
```

**Used in codebase:**
- `clipboard.readText()` — `services/clipboard.ts`
- `clipboard.writeText(data)` — `services/clipboard.ts`
- `clipboard.clear()` — `services/clipboard.ts`

**Only the above 3 functions are actively used.** The rest can be `vi.fn()`.

---

### `events` — namespace object

```ts
declare namespace events {
  export function on(
    event: string,
    handler: (ev: CustomEvent) => void
  ): Promise<Response>;
  export function off(
    event: string,
    handler: (ev: CustomEvent) => void
  ): Promise<Response>;
  export function dispatch(
    event: string,
    data?: any
  ): Promise<Response>;
  export function broadcast(event: string, data?: any): Promise<void>;
}
```

**Used in codebase:**
- `events.on("watchFile", handler)` — `services/watcher.ts`
- `events.off("watchFile", handler)` — `services/watcher.ts`

**Only the above 2 functions are actively used.** The rest can be `vi.fn()`.

---

## Type-Only Exports (erased at compile time — no mock needed, but include for reference)

These are imported with `type` keyword and will be erased by TypeScript.
They exist in the module's type declarations but have no runtime presence.
Including them in the mock is harmless and helps test files that cast or
reference the types.

| Export | Kind | Files using it |
|--------|------|----------------|
| `ExecCommandOptions` | interface | neutralino.ts, pass.ts, gpg.ts |
| `ExecCommandResult` | interface | neutralino.ts, pass.ts, gpg.ts, entries.ts |
| `OperatingSystem` | enum | neutralino.ts |
| `DirectoryEntry` | interface | filesystem.ts |
| `DirectoryReaderOptions` | interface | filesystem.ts |
| `FileReaderOptions` | interface | filesystem.ts |
| `PathParts` | interface | filesystem.ts |
| `Stats` | interface | filesystem.ts |
| `FolderDialogOptions` | interface | dialog.ts |
| `Icon` | enum | dialog.ts |
| `MessageBoxChoice` | enum | dialog.ts |
| `OpenDialogOptions` | interface | dialog.ts |
| `SaveDialogOptions` | interface | dialog.ts |
| `KnownPath` | type alias | path.ts |

## Key Interface Definitions (for replicating return values in test data)

```ts
interface ExecCommandOptions {
  stdIn?: string;
  background?: boolean;
  cwd?: string;
  envs?: Record<string, string>;
}

interface ExecCommandResult {
  pid: number;
  stdOut: string;
  stdErr: string;
  exitCode: number;
}

interface DirectoryEntry {
  entry: string;
  path: string;
  type: string;
}

interface FileReaderOptions {
  pos: number;
  size: number;
}

interface DirectoryReaderOptions {
  recursive: boolean;
}

interface Stats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  createdAt: number;
  modifiedAt: number;
}

interface PathParts {
  rootName: string;
  rootDirectory: string;
  rootPath: string;
  relativePath: string;
  parentPath: string;
  filename: string;
  stem: string;
  extension: string;
}

// Error type thrown by NeutralinoJS methods on failure
interface Error {
  code: ErrorCode;
  message: string;
}
```

> The app mirrors this error structure as `NeuErrorObj` in `types/index.ts`:
> ```ts
> type NeuErrorObj = { code: NeuErrorCode; message: string };
> ```
> And catches Neutralino errors in `services/filesystem.ts` using:
> ```ts
> const err = e as NeuErrorObj;
> if (err?.code === NEU_ERROR_CODES_MAP.DirectoryCreationFailed) { ... }
> ```

## Recommended Mock Factory

Create a shared file at `client/src/__mocks__/@neutralinojs/lib.ts` for auto-hoisted
module mocking, OR export a factory function from a test helper for manual
`vi.mock()` calls per test file.

### Option A: Auto-mock file (recommended)

Vitest auto-loads `__mocks__/@neutralinojs/lib.ts` when `vi.mock("@neutralinojs/lib")`
is called. This is the cleanest pattern for a shared mock.

**`client/src/__mocks__/@neutralinojs/lib.ts`:**

```ts
import { vi } from "vitest";

const defaultExecCommandResult = {
  pid: 12345,
  stdOut: "",
  stdErr: "",
  exitCode: 0,
};

function createMockExecCommandResult(
  overrides?: Partial<typeof defaultExecCommandResult>
): typeof defaultExecCommandResult {
  return { ...defaultExecCommandResult, ...overrides };
}

const os = {
  execCommand: vi.fn(() => Promise.resolve(createMockExecCommandResult())),
  getEnv: vi.fn(() => Promise.resolve("")),
  getEnvs: vi.fn(() => Promise.resolve({})),
  getLocale: vi.fn(() => Promise.resolve({ locale: "en_US", language: "en", region: "US" })),
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
  getOpenedFileInfo: vi.fn(() => Promise.resolve({ id: 1, eof: false, pos: 0, lastRead: 0 })),
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
  getAbsolutePath: vi.fn(p => Promise.resolve(p)),
  getRelativePath: vi.fn(p => Promise.resolve(p)),
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
  getJoinedPath: vi.fn((...paths) => Promise.resolve(paths.join("/"))),
  getNormalizedPath: vi.fn(p => Promise.resolve(p)),
  getUnnormalizedPath: vi.fn(p => Promise.resolve(p)),
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
  on: vi.fn(() => Promise.resolve({ success: true, message: "ok" })),
  off: vi.fn(() => Promise.resolve({ success: true, message: "ok" })),
  dispatch: vi.fn(() => Promise.resolve({ success: true, message: "ok" })),
  broadcast: vi.fn(() => Promise.resolve()),
};

// This is the default export accessed via `import Neutralino from "@neutralinojs/lib"`
const init = vi.fn();

const mockNeutralino = {
  init,
  os,
  filesystem,
  debug,
  clipboard,
  events,
  app: {
    broadcast: vi.fn(),
    exit: vi.fn(),
    getConfig: vi.fn(),
    getProcessId: vi.fn(),
    killProcess: vi.fn(),
    readProcessInput: vi.fn(),
    restartProcess: vi.fn(),
    writeProcessError: vi.fn(),
    writeProcessOutput: vi.fn(),
  },
  computer: {
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
  },
  storage: {
    clear: vi.fn(),
    getData: vi.fn(),
    getKeys: vi.fn(),
    removeData: vi.fn(),
    setData: vi.fn(),
  },
  resources: {
    extractDirectory: vi.fn(),
    extractFile: vi.fn(),
    getFiles: vi.fn(),
    getStats: vi.fn(),
    readBinaryFile: vi.fn(),
    readFile: vi.fn(),
  },
  server: {
    getMounts: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
  },
  updater: {
    checkForUpdates: vi.fn(),
    install: vi.fn(),
  },
  custom: {
    getMethods: vi.fn(),
  },
  // Enums referenced as types (provided for runtime reference if needed)
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

// Not exported from the lib but used by the app:
// ExecCommandResult, ExecCommandOptions, etc. are interfaces, not runtime values.
// They are provided in the __mocks__ file only so tests can reference them.

export default mockNeutralino;
export {
  init,
  os,
  filesystem,
  debug,
  clipboard,
  events,
};

// Export helper for tests that need custom return values
export { createMockExecCommandResult };
```

### Option B: Per-test factory for inline `vi.mock`

Use this when a test needs its own `vi.mock` call with custom defaults:

```ts
vi.mock("@neutralinojs/lib", () => {
  const os = {
    execCommand: vi.fn(),
    getEnv: vi.fn(),
    getPath: vi.fn(),
    // ... add only what's needed
  };
  return {
    default: { init: vi.fn(), os /* ... */ },
    init: vi.fn(),
    os,
    // ... other namespaces
  };
});
```

## Gotchas

### 1. `init()` has real side effects

`init()` is called at app startup in `main.ts`:
```ts
import Neutralino from "@neutralinojs/lib";
Neutralino.init();
```

In production, `init()` opens a WebSocket to the Neutralino server, registers
event listeners, and sets globals like `window.NL_CVERSION`. The mock MUST
replace `init` with `vi.fn()` to prevent test failures from WebSocket attempts.

### 2. `window.NL_OS` global is read, not the import

The `OperatingSystem` enum is imported as a **type** only:
```ts
import { type OperatingSystem, os, debug } from "@neutralinojs/lib";
```

The actual OS value comes from the global `window.NL_OS`:
```ts
public OS: OperatingSystem = window.NL_OS;
```

**Tests must mock `window.NL_OS`** in the test setup (or per-file) alongside
the module mock. Add this to `vitest.setup.ts` or at the top of service tests:

```ts
Object.defineProperty(window, "NL_OS", { value: "Linux" });
Object.defineProperty(window, "NL_HOME_DIR", { value: "/home/user" });
```

### 3. Error objects thrown by NeutralinoJS

NeutralinoJS operations throw errors shaped like:
```ts
{ code: "NE_FS_DIRCRER", message: "Failed to create directory" }
```

These are caught in the service layer as `NeuErrorObj` and checked against
`NEU_ERROR_CODES_MAP`. When mocking rejection behavior, return this shape:

```ts
os.execCommand.mockRejectedValue({
  code: "NE_RT_NATRTER",
  message: "Native method failed",
});
```

The app's `NEU_ERROR_CODES` mapping in `errors.ts` defines every known code.

### 4. `ExecCommandResult` used both as return value and error context

`ExecCommandResult` is passed through `CommandFailedError`:
```ts
throw new CommandFailedError({ cmd, args, ...result });
```

Test data factories should provide complete `ExecCommandResult` objects:
```ts
const mockResult = {
  pid: 12345,
  stdOut: "output",
  stdErr: "",
  exitCode: 0,
};
```

### 5. Namespace imports vs. named function imports

The lib exports everything as **namespace objects** (e.g., `os`,
`filesystem`, `debug`), not individual functions. This means:

```ts
import { os } from "@neutralinojs/lib";        // ✅ namespace
os.execCommand("cmd");                          // ✅
import { execCommand } from "@neutralinojs/lib"; // ❌ not a direct export
```

The mock factory must mirror this namespace structure exactly.

### 6. CJS vs ESM interop with `vi.mock`

Since `@neutralinojs/lib` ships both CJS and ESM, Vitest may resolve either
depending on the bundler config. The mock factory works the same either way —
just return the export shape. The `default` export (for `import Neutralino from`
syntax) is the same as the full module exports object.

### 7. `filesystem.getRelativePath` and `filesystem.getJoinedPath` are used without `wrapAsync`

These two functions are called without `wrapAsync` (unlike most others):
```ts
static async join(...paths: string[]): Promise<string> {
  return await filesystem.getJoinedPath(...paths);        // direct await
}

static async relativePath(absolutePath: string, base: string): Promise<string> {
  return await filesystem.getRelativePath(absolutePath, base); // direct await
}
```

This means they must `return` a matching type, not throw. The mock should
resolve with a sensible default.

### 8. No DI container to inject — mocking is the only seam

The app uses `vi.mock` as the sole mocking strategy (Option B from the
strategy doc). There's no dependency injection, no inversion of control,
no factory pattern. Every service module imports `@neutralinojs/lib`
directly at the top level. Module-level mocking with `vi.mock` is the
correct and only practical approach.

## Recommended File Layout

```
client/src/
├── __mocks__/
│   └── @neutralinojs/
│       └── lib.ts              # Auto-hoisted mock (Option A)
├── test-utils/
│   ├── create-mock-neu.ts      # Factory function (for explicit vi.mock calls)
│   └── fixtures.ts             # Default ExecCommandResult, DirectoryEntry etc.
└── services/
    ├── neutralino.test.ts
    ├── filesystem.test.ts
    └── ...
```

## Verification Checklist

Before writing tests against the mock, verify:

- [ ] `vi.mock("@neutralinojs/lib")` hoists correctly (Vitest auto-hoists to top)
- [ ] `init()` is a `vi.fn()` no-op — no WebSocket attempts in test output
- [ ] `os.execCommand` returns a valid `ExecCommandResult` shape by default
- [ ] `filesystem.readDirectory` returns `DirectoryEntry[]` by default
- [ ] `window.NL_OS` is mocked separately in test setup
- [ ] Mock rejects with `{ code, message }` shape for error-path tests
- [ ] TypeScript compilation passes with the mock (no missing property errors)
