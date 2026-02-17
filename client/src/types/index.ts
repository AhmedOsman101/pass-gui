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

type AllowedCommand =
  | "pass"
  | "gpg"
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
};
