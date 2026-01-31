import type { NeuErrorCode } from "@/lib/constants";

type NeuError = {
  code: NeuErrorCode;
  message: string;
};

export type { NeuError };
