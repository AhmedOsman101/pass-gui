import type { z } from "zod";
import type { Stringifiable } from "@/types";

/**
 * Mapping of NeutralinoJS error codes to human-readable error types.
 * Used for structured error handling across the application.
 */
const NEU_ERROR_CODES = Object.freeze({
  // storage
  NE_ST_INVSTKY: "InvalidStorageKeyError",
  NE_ST_NOSTKEX: "StorageKeyNotFound",
  NE_ST_STKEYWE: "StorageWriteError",
  NE_ST_STKEYRE: "StorageKeyRemoveError",
  NE_ST_NOSTDIR: "StorageDirectoryReadError",
  // os
  NE_OS_UNLTOUP: "UpdateProcessFailed",
  NE_OS_INVNOTA: "InvalidNotificationArgError",
  NE_OS_INVMSGA: "InvalidMessageBoxArgError",
  NE_OS_TRAYIER: "SystemTrayError",
  NE_OS_INVKNPT: "InvalidPathError",
  NE_OS_UNLTRAS: "TrashItemFailed",
  // computer
  NE_CO_UNLTOSC: "UnsupportedMousePosition",
  NE_CO_UNLTOMG: "UnsupportedMouseGrabbing",
  NE_CO_UNLTONI: "UnsupportedNetworkInterface",
  NE_CO_UNLTOSK: "UnsupportedKeyboardSend",
  // extensions
  NE_EX_EXTNOTC: "ExtensionNotConnected",
  // filesystem
  NE_FS_FILWRER: "FileWriteFailed",
  NE_FS_DIRCRER: "DirectoryCreationFailed",
  NE_FS_REMVERR: "DeletionFailed",
  NE_FS_FILRDER: "FileReadFailed",
  NE_FS_NOPATHE: "PathNotFound",
  NE_FS_NOTADIR: "NotADirectory",
  NE_FS_COPYERR: "CopyError",
  NE_FS_MOVEERR: "MoveError",
  NE_FS_FILOPER: "FileOpenFailed",
  NE_FS_UNLTOUP: "UpdateFileIdFailed",
  NE_FS_UNLTFOP: "FindFileIdFailed",
  NE_FS_UNLCWAT: "CreateWatcherFailed",
  NE_FS_NOWATID: "FindWatcherFailed",
  NE_FS_UNLSTPR: "SetFilePermissionsFailed",
  NE_FS_ACSFAIL: "AccessCheckFailed",
  NE_FS_CHMDERR: "ChmodError",
  NE_FS_CHWNERR: "ChownError",
  // window
  NE_WI_UNBSWSR: "UnsupportedBrowserWindowSessionRestore",
  // router
  NE_RT_INVTOKN: "InvalidAccessToken",
  NE_RT_APIPRME: "NoPermissionNativeApi",
  NE_RT_NATPRME: "NoPermissionNativeMethod",
  NE_RT_NATRTER: "NativeMethodError",
  NE_RT_NATNTIM: "NativeMethodNotImplemented",
  // resources
  NE_RS_TREEGER: "ResourceTriggerError",
  NE_RS_UNBLDRE: "UnableToLoadResources",
  NE_RS_NOPATHE: "ResourceNotFound",
  NE_RS_FILEXTF: "ExtractFileFailed",
  NE_RS_DIREXTF: "ExtractDirectoryFailed",
  // server
  NE_SR_UNBSEND: "UnableToSendData",
  NE_SR_UNBPARS: "UnableToParseData",
  NE_SR_MPINUSE: "MountPathInUse",
  NE_SR_NOMTPTH: "UnmountPathFailed",
  // config
  NE_CF_UNBLDCF: "UnableToLoadConfig",
  NE_CF_UNBPRCF: "UnableToParseConfig",
  NE_CF_UNSUPMD: "UnsupportedMode",
  NE_CF_UNBLWCF: "UnableToWriteConfig",
  // extensions (legacy)
  NE_CL_NSEROFF: "NeuServerNotReachable",
  // updater
  NE_UP_CUPDERR: "FetchUpdateManifestError",
  NE_UP_CUPDMER: "InvalidUpdateManifestOrAppId",
  NE_UP_UPDINER: "UpdateInstallationError",
  NE_UP_UPDNOUF: "UpdateManifestNotLoaded",
} as const);

type NeuErrorCode = keyof typeof NEU_ERROR_CODES;
type NeuErrorMap = (typeof NEU_ERROR_CODES)[NeuErrorCode];

/**
 * Reverse mapping from error type strings to error codes.
 */
const NEU_ERROR_CODES_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(NEU_ERROR_CODES).map(([k, v]) => [v, k])
  ) as { [K in NeuErrorCode as (typeof NEU_ERROR_CODES)[K]]: K }
);

/**
 * Base error class for NeutralinoJS-related errors.
 * Extends the native Error with type and code information.
 */
class NeuError extends Error {
  public type: NeuErrorMap;
  public code: NeuErrorCode;

  constructor(
    type: NeuErrorMap,
    code: NeuErrorCode,
    message?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.type = type;
    this.code = code;
  }
}

/**
 * Specialized error for directory creation failures.
 * Includes the path that failed to be created.
 */
class DirectoryCreationError extends NeuError {
  public path: string;

  constructor(
    type: NeuErrorMap,
    code: NeuErrorCode,
    path: string,
    message?: string,
    options?: ErrorOptions
  ) {
    super(type, code, message, options);
    this.path = path;
  }
}

/**
 * Specialized error for file write failures.
 * Includes the path that failed to be written.
 */
class FileWriteError extends NeuError {
  public path: string;

  constructor(
    type: NeuErrorMap,
    code: NeuErrorCode,
    path: string,
    message?: string,
    options?: ErrorOptions
  ) {
    super(type, code, message, options);
    this.path = path;
  }
}

/**
 * Error types for configuration-related failures.
 */
const CONFIG_ERROR_CODES = Object.freeze({
  CONFIG_NOT_FOUND: "ConfigNotFound",
  CONFIG_PARSE_ERROR: "ConfigParseError",
  CONFIG_WRITE_ERROR: "ConfigWriteError",
  CONFIG_VALIDATION_ERROR: "ConfigValidationError",
} as const);

type ConfigErrorCode = keyof typeof CONFIG_ERROR_CODES;
type ConfigErrorType = (typeof CONFIG_ERROR_CODES)[ConfigErrorCode];

/**
 * Error thrown when the configuration file cannot be found.
 */
class ConfigNotFoundError extends Error {
  public code: ConfigErrorCode;
  public type: ConfigErrorType;
  public path: string;

  constructor(path: string, message?: string) {
    super(message ?? `Configuration file not found at: ${path}`);
    this.code = "CONFIG_NOT_FOUND";
    this.type = CONFIG_ERROR_CODES.CONFIG_NOT_FOUND;
    this.path = path;
  }
}

/**
 * Error thrown when TOML parsing fails.
 * Includes parse error details from @ltd/j-toml.
 */
class ConfigParseError extends Error {
  public code: ConfigErrorCode;
  public type: ConfigErrorType;
  public parseError: Error | null;

  constructor(parseError: Error, message?: string) {
    super(message ?? `Failed to parse configuration: ${parseError.message}`);
    this.code = "CONFIG_PARSE_ERROR";
    this.type = CONFIG_ERROR_CODES.CONFIG_PARSE_ERROR;
    this.parseError = parseError;
  }
}

/**
 * Error thrown when writing the configuration file fails.
 */
class ConfigWriteError extends Error {
  public code: ConfigErrorCode;
  public type: ConfigErrorType;
  public path: string;

  constructor(path: string, message?: string) {
    super(message ?? `Failed to write configuration to: ${path}`);
    this.code = "CONFIG_WRITE_ERROR";
    this.type = CONFIG_ERROR_CODES.CONFIG_WRITE_ERROR;
    this.path = path;
  }
}

/**
 * Error thrown when configuration validation fails.
 * Used for missing required fields or invalid values.
 */
class ConfigValidationError extends Error {
  public code: ConfigErrorCode;
  public type: ConfigErrorType;
  public zodError: z.ZodError | null;

  constructor(message: string, zodError?: z.ZodError) {
    super(message);
    this.code = "CONFIG_VALIDATION_ERROR";
    this.type = CONFIG_ERROR_CODES.CONFIG_VALIDATION_ERROR;
    this.zodError = zodError ?? null;
  }
}

/**
 * Error codes for store validation failures.
 */
const STORE_ERROR_CODES = Object.freeze({
  STORE_DIR_NOT_FOUND: "StoreDirNotFound",
  STORE_DIR_NOT_DIRECTORY: "StoreDirNotDirectory",
  STORE_GPG_ID_MISSING: "StoreGpgIdMissing",
  STORE_GPG_ID_EMPTY: "StoreGpgIdEmpty",
  STORE_GPG_ID_PARSE_ERROR: "StoreGpgIdParseError",
  STORE_RECIPIENT_UNKNOWN: "StoreRecipientUnknown",
  STORE_BEHAVIORAL_CHECK_FAILED: "StoreBehavioralCheckFailed",
} as const);

type StoreErrorCode = keyof typeof STORE_ERROR_CODES;
type StoreErrorType = (typeof STORE_ERROR_CODES)[StoreErrorCode];

/**
 * Error thrown when store validation fails.
 */
class StoreValidationError extends Error {
  public code: StoreErrorCode;
  public type: StoreErrorType;
  public storePath: string;

  constructor(
    code: StoreErrorCode,
    storePath: string,
    message?: string,
    options?: ErrorOptions
  ) {
    super(
      message ??
        `Store validation failed: ${STORE_ERROR_CODES[code]} at ${storePath}`,
      options
    );
    this.code = code;
    this.type = STORE_ERROR_CODES[code];
    this.storePath = storePath;
  }
}

/**
 * Error thrown when a shell command exits with a non-zero exit code.
 * Captures the full execution context for debugging and error reporting.
 */
class CommandFailedError extends Error {
  public cmd: string;
  public args?: Stringifiable[];
  public exitCode: number;
  public stdOut: string;
  public stdErr: string;
  public pid: number;

  constructor(opts: {
    cmd: string;
    args?: Stringifiable[];
    exitCode: number;
    stdOut: string;
    stdErr: string;
    pid: number;
    message?: string;
    options?: ErrorOptions;
  }) {
    super(
      opts.message ??
        `Command failed: ${opts.cmd}${opts.args?.join(" ")} (exit code ${opts.exitCode})`,
      opts.options
    );
    this.cmd = opts.cmd;
    this.exitCode = opts.exitCode;
    this.stdOut = opts.stdOut;
    this.stdErr = opts.stdErr;
    this.pid = opts.pid;

    if (opts.args) {
      this.args = opts.args.length === 0 ? [" "] : ["", ...opts.args];
    }
  }
}

/**
 * Error codes for entry operation failures (show, insert, rm, mv, generate, clipboard).
 */
const ENTRY_ERROR_CODES = Object.freeze({
  ENTRY_NOT_FOUND: "EntryNotFound",
  ENTRY_ALREADY_EXISTS: "EntryAlreadyExists",
  ENTRY_PARSE_ERROR: "EntryParseError",
  CLIPBOARD_ERROR: "ClipboardError",
  MUTATION_FAILED: "MutationFailed",
} as const);

/** Union of all entry error code keys. */
type EntryErrorCode = keyof typeof ENTRY_ERROR_CODES;

/** Union of all entry error type string values. */
type EntryErrorType = (typeof ENTRY_ERROR_CODES)[EntryErrorCode];

/**
 * Error thrown when a password entry is not found in the store.
 */
class EntryNotFoundError extends Error {
  public code: EntryErrorCode;
  public type: EntryErrorType;
  public path: string;

  constructor(path: string, message?: string) {
    super(message ?? `Entry not found: ${path}`);
    this.code = "ENTRY_NOT_FOUND";
    this.type = ENTRY_ERROR_CODES.ENTRY_NOT_FOUND;
    this.path = path;
  }
}

/**
 * Error thrown when attempting to create an entry that already exists.
 */
class EntryAlreadyExistsError extends Error {
  public code: EntryErrorCode;
  public type: EntryErrorType;
  public path: string;

  constructor(path: string, message?: string) {
    super(message ?? `Entry already exists: ${path}`);
    this.code = "ENTRY_ALREADY_EXISTS";
    this.type = ENTRY_ERROR_CODES.ENTRY_ALREADY_EXISTS;
    this.path = path;
  }
}

/**
 * Error thrown when `pass show` output cannot be parsed.
 */
class EntryParseError extends Error {
  public code: EntryErrorCode;
  public type: EntryErrorType;
  public raw: string;

  constructor(raw: string, message?: string) {
    super(message ?? "Failed to parse entry output");
    this.code = "ENTRY_PARSE_ERROR";
    this.type = ENTRY_ERROR_CODES.ENTRY_PARSE_ERROR;
    this.raw = raw;
  }
}

/**
 * Error thrown when a clipboard operation fails.
 */
class ClipboardError extends Error {
  public code: EntryErrorCode;
  public type: EntryErrorType;
  public selection: string;

  constructor(selection: string, message?: string) {
    super(message ?? `Clipboard operation failed: ${selection}`);
    this.code = "CLIPBOARD_ERROR";
    this.type = ENTRY_ERROR_CODES.CLIPBOARD_ERROR;
    this.selection = selection;
  }
}

/**
 * Error thrown when a pass mutation (insert, rm, mv, generate) fails.
 */
class MutationError extends Error {
  public code: EntryErrorCode;
  public type: EntryErrorType;
  public exitCode: number;
  public stderr: string;

  constructor(exitCode: number, stderr: string, message?: string) {
    super(message ?? `Mutation failed (exit code ${exitCode}): ${stderr}`);
    this.code = "MUTATION_FAILED";
    this.type = ENTRY_ERROR_CODES.MUTATION_FAILED;
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

export type {
  ConfigErrorCode,
  ConfigErrorType,
  EntryErrorCode,
  EntryErrorType,
  NeuErrorCode,
  NeuErrorMap,
  StoreErrorCode,
  StoreErrorType,
};

export {
  ClipboardError,
  CONFIG_ERROR_CODES,
  CommandFailedError,
  ConfigNotFoundError,
  ConfigParseError,
  ConfigValidationError,
  ConfigWriteError,
  DirectoryCreationError,
  ENTRY_ERROR_CODES,
  EntryAlreadyExistsError,
  EntryNotFoundError,
  EntryParseError,
  FileWriteError,
  MutationError,
  NEU_ERROR_CODES,
  NEU_ERROR_CODES_MAP,
  NeuError,
  STORE_ERROR_CODES,
  StoreValidationError,
};
