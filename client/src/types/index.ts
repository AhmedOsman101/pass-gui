import type { NeuErrorCode } from "@/lib/errors";

type Stringifiable = string | number | boolean | bigint;

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

export type { NeuErrorObj, Stringifiable, OsType, Version };
