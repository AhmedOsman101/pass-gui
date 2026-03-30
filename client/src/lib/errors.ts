import type { z } from "zod";

/**
 * Mapping of NeutralinoJS error codes to human-readable error types.
 * Used for structured error handling across the application.
 */
const NEU_ERROR_CODES = Object.freeze({
  NE_CL_NSEROFF: "NeuServerNotReachable",
  NE_EX_EXTNOTC: "ExtensionNotConnected",
  NE_FS_COPYERR: "CopyError",
  NE_FS_DIRCRER: "DirectoryCreationFailed",
  NE_FS_FILOPER: "FileOpenFailed",
  NE_FS_FILRDER: "FileReadFailed",
  NE_FS_FILWRER: "FileWriteFailed",
  NE_FS_MOVEERR: "MoveError",
  NE_FS_NOPATHE: "PathNotFound",
  NE_FS_NOWATID: "FindWatcherFailed",
  NE_FS_REMVERR: "DeletionFailed",
  NE_FS_UNLCWAT: "CreateWatcherFailed",
  NE_FS_UNLSTPR: "SetFilePermissionsFailed",
  NE_FS_UNLTFOP: "FindFileIdFailed",
  NE_FS_UNLTOUP: "UpdateFileIdFailed",
  NE_OS_INVKNPT: "InvalidPathError",
  NE_OS_INVMSGA: "InvalidMessageBoxArgError",
  NE_OS_TRAYIER: "SystemTrayError",
  NE_OS_UNLTOUP: "UpdateProcessFailed",
  NE_RS_DIREXTF: "ExtractDirectoryFailed",
  NE_RS_FILEXTF: "ExtractFileFailed",
  NE_RS_NOPATHE: "ResourceNotFound",
  NE_RT_APIPRME: "NoPermissionNativeApi",
  NE_RT_INVTOKN: "InvalidAccessToken",
  NE_RT_NATNTIM: "NativeMethodNotImplemented",
  NE_RT_NATPRME: "NoPermissionNativeMethod",
  NE_RT_NATRTER: "NativeMethodError",
  NE_SR_MPINUSE: "MountPathInUse",
  NE_SR_NOMTPTH: "UnmountPathFailed",
  NE_ST_INVSTKY: "InvalidStorageKeyError",
  NE_ST_STKEYWE: "StorageWriteError",
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

export {
  type NeuErrorCode,
  type NeuErrorMap,
  NeuError,
  DirectoryCreationError,
  NEU_ERROR_CODES,
  NEU_ERROR_CODES_MAP,
  CONFIG_ERROR_CODES,
  type ConfigErrorCode,
  type ConfigErrorType,
  ConfigNotFoundError,
  ConfigParseError,
  ConfigWriteError,
  ConfigValidationError,
};
