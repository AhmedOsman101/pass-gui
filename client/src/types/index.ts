import type { NeuErrorCode } from "@/lib/errors";

type Stringifiable = string | number | boolean | bigint;

type FileSystemTree = Array<string | FileSystemTree>;

type NeuErrorObj = {
  code: NeuErrorCode;
  message: string;
};

type OsType = "Linux" | "Darwin" | "Windows NT" | "Unknown";

type Version = {
  major: number;
  minor: number;
  patch: number;
};

type PassBinaryInfo = {
  path: string;
  isSystemBinary: boolean;
};

type GpgBinaryInfo = {
  path: string;
  command: string;
};

type SecretKey = {
  keyId: string;
  fingerprint?: string;
  userId: string;
  userIds: string[];
  algorithm: string;
  creationDate: string | null;
  expirationDate: string | null;
};

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
