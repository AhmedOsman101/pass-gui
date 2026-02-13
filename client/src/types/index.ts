import type { NeuErrorCode } from "@/lib/constants";

type NeuError = {
  code: NeuErrorCode;
  message: string;
};

type EnvVar = string | number | boolean | bigint;

type OsType = "Linux" | "Darwin" | "Windows NT" | "Unknown";

export type { NeuError, EnvVar, OsType };
