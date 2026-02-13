import type { NeuErrorCode, NeuErrorMap } from "./constants";

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

export { NeuError, DirectoryCreationError };
