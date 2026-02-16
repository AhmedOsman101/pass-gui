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

const NEU_ERROR_CODES_MAP = Object.freeze(
  Object.fromEntries(
    Object.entries(NEU_ERROR_CODES).map(([k, v]) => [v, k])
  ) as { [K in NeuErrorCode as (typeof NEU_ERROR_CODES)[K]]: K }
);

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

export {
  type NeuErrorCode,
  type NeuErrorMap,
  NeuError,
  DirectoryCreationError,
  NEU_ERROR_CODES,
  NEU_ERROR_CODES_MAP,
};
