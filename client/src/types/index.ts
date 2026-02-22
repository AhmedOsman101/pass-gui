import type { NeuErrorCode } from "@/lib/errors";

/**
 * Types that can be safely converted to string.
 */
type Stringifiable = string | number | boolean | bigint;

/**
 * Recursive type representing a file system tree structure.
 * Each item is either a string (file/folder name) or an array
 * where the first element is the folder name and rest are children.
 */
type FileSystemTree = Array<string | FileSystemTree>;

/**
 * Raw error object structure returned by NeutralinoJS.
 */
type NeuErrorObj = {
  code: NeuErrorCode;
  message: string;
};

/**
 * Supported operating system types.
 */
type OsType = "Linux" | "Darwin" | "Windows NT" | "Unknown";

/**
 * Semantic version representation.
 */
type Version = {
  major: number;
  minor: number;
  patch: number;
};

/**
 * Information about the pass binary after validation.
 */
type PassBinaryInfo = {
  path: string;
  isSystemBinary: boolean;
};

/**
 * Information about the GPG binary after validation.
 */
type GpgBinaryInfo = {
  path: string;
  command: string;
};

/**
 * Represents a GPG secret key with its metadata.
 */
type SecretKey = {
  keyId: string;
  fingerprint?: string;
  userId: string;
  userIds: string[];
  algorithm: string;
  creationDate: string | null;
  expirationDate: string | null;
};

/**
 * Commands allowed to be executed through the safeExec method.
 * This whitelist prevents arbitrary command execution.
 */
type AllowedCommand =
  | "pass"
  | "gpg"
  | "gpg2"
  | "type"
  | "ls"
  | "where.exe"
  | "which"
  | "readlink"
  | "file";

export type {
  NeuErrorObj,
  Stringifiable,
  OsType,
  Version,
  PassBinaryInfo,
  AllowedCommand,
  FileSystemTree,
  GpgBinaryInfo,
  SecretKey,
};
