import type { NeuErrorCode } from "@/lib/errors";

declare const __brand: unique symbol;
/**
 * A branded type constructor that adds a unique brand to a type.
 * Used to create distinct types from primitive types for type safety.
 * @example
 * type UserId = Brand<string, "userId">;
 * const userId = "abc" as UserId; // Type-safe string
 */
type Brand<T, TBrand> = T & { [__brand]: TBrand };

/**
 * Types that can be safely converted to string.
 */
type Stringifiable = string | number | boolean | bigint | null;

/**
 * Recursive type representing a file system tree structure.
 * Each item is either a string (file/folder name) or an array
 * where the first element is the folder name and rest are children.
 */
type FileSystemTree = (string | FileSystemTree)[];

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
  patch?: number;
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
const ALLOWED_COMMANDS = [
  "file",
  "gpg",
  "gpg2",
  "ls",
  "pass",
  "readlink",
  "tree",
  "type",
  "where.exe",
  "which",
] as const;

/** Commands allowed to be executed through the safeExec method. */
type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

export type {
  AllowedCommand,
  Brand,
  FileSystemTree,
  GpgBinaryInfo,
  NeuErrorObj,
  OsType,
  PassBinaryInfo,
  SecretKey,
  Stringifiable,
  Version,
};
export { ALLOWED_COMMANDS };
