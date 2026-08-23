import { Err, ErrFromText, Ok, type Result } from "lib-result";
import type { StoreConfig } from "@/types/config";
import { Config } from "./config";
import { Fs } from "./filesystem";
import { Pass } from "./pass";
import { StoreValidation } from "./store-validation";

type StoreDetails = StoreConfig & { name: string };

/**
 * Error thrown by `Store.create()`. `kind` discriminates the failed
 * step (mkdir / pass init / config write) so callers can react
 * precisely; `path` is the store directory the recipe operated on.
 */
class CreateStoreError extends Error {
  public kind:
    | "already-exists"
    | "mkdir-failed"
    | "pass-init-failed"
    | "config-write-failed";
  public path: string;
  constructor(
    kind: CreateStoreError["kind"],
    path: string,
    message: string,
    cause?: Error
  ) {
    super(message, cause ? { cause } : undefined);
    this.kind = kind;
    this.path = path;
  }
}

/**
 * Error thrown by `Store.add()`. `kind` discriminates the failed
 * step (validation / config write); `path` is the store directory.
 */
class AddStoreError extends Error {
  public kind: "already-exists" | "validation-failed" | "config-write-failed";
  public path: string;
  constructor(
    kind: AddStoreError["kind"],
    path: string,
    message: string,
    cause?: Error
  ) {
    super(message, cause ? { cause } : undefined);
    this.kind = kind;
    this.path = path;
  }
}

class Store {
  static async get(name: string): Promise<Result<StoreDetails>> {
    return (await Config.getValue("stores", name)).andThen(store => {
      if (!store || (!store.path && !store.gnupg_home)) {
        return ErrFromText("Store not found");
      }
      if (!store.path && store.gnupg_home) {
        return ErrFromText("Store path is missing");
      }
      return Ok({ ...store, name });
    });
  }

  /**
   * Creates a brand-new password store: mkdir → scoped `pass init`
   * → config write. The scoped-call pattern (`Pass.exec(args, { cwd,
   * envs })`) keeps `Pass.storePath` untouched. If pass init fails
   * and we created the directory, it is removed again (rollback).
   */
  static async create(
    name: string,
    data: { path: string; gpgKeyId: string }
  ): Promise<Result<StoreConfig, CreateStoreError>> {
    const existingResult = await Store.get(name);
    if (existingResult.isOk()) {
      return Err(
        new CreateStoreError(
          "already-exists",
          data.path,
          `Store "${name}" already exists`
        )
      );
    }

    const existedBefore = (await Fs.isDirectory(data.path)).unwrapOr(false);

    // Fs.mkdir no-ops when the directory already exists.
    const mkdirResult = await Fs.mkdir(data.path);
    if (mkdirResult.isError()) {
      return Err(
        new CreateStoreError(
          "mkdir-failed",
          data.path,
          `Failed to create directory: ${mkdirResult.error.message}`,
          mkdirResult.error
        )
      );
    }

    const initResult = await Pass.exec(["init", data.gpgKeyId], {
      cwd: data.path,
      envs: { PASSWORD_STORE_DIR: data.path },
    });
    if (initResult.isError()) {
      // Roll back the directory only if this recipe created it —
      // never touch a pre-existing user directory.
      if (!existedBefore) {
        await Fs.rmdir(data.path);
      }
      return Err(
        new CreateStoreError(
          "pass-init-failed",
          data.path,
          `pass init failed: ${initResult.error.message}`,
          initResult.error
        )
      );
    }

    const configResult = await Config.setValue("stores", name, {
      path: data.path,
    });
    if (configResult.isError()) {
      return Err(
        new CreateStoreError(
          "config-write-failed",
          data.path,
          `Failed to add store to config: ${configResult.error.message}`,
          configResult.error
        )
      );
    }

    return Ok({ path: data.path });
  }

  /**
   * Adds an existing, already-initialized password store to the
   * config — no mkdir, no pass init.
   */
  static async add(
    name: string,
    data: { path: string }
  ): Promise<Result<StoreConfig, AddStoreError>> {
    const existingResult = await Store.get(name);
    if (existingResult.isOk()) {
      return Err(
        new AddStoreError(
          "already-exists",
          data.path,
          `Store "${name}" already exists`
        )
      );
    }

    const validation = await StoreValidation.validate(data.path);
    if (validation.isError()) {
      return Err(
        new AddStoreError(
          "validation-failed",
          data.path,
          `Store validation failed: ${validation.error.message}`,
          validation.error
        )
      );
    }
    if (!validation.ok.initialized) {
      return Err(
        new AddStoreError(
          "validation-failed",
          data.path,
          `Not an initialized password store: ${data.path}`
        )
      );
    }

    const configResult = await Config.setValue("stores", name, {
      path: data.path,
    });
    if (configResult.isError()) {
      return Err(
        new AddStoreError(
          "config-write-failed",
          data.path,
          `Failed to add store to config: ${configResult.error.message}`,
          configResult.error
        )
      );
    }

    return Ok({ path: data.path });
  }

  static async set(
    name: string,
    data: Partial<StoreConfig>
  ): Promise<Result<void>> {
    const store = await Store.get(name);
    if (store.isError()) return Err(store.error);

    return await Config.setValue("stores", name, {
      path: data.path ?? store.ok.path,
      gnupg_home: data.gnupg_home ?? store.ok.gnupg_home,
    });
  }

  static async delete(name: string): Promise<Result<void>> {
    const store = await Store.get(name);
    if (store.isError()) return Err(store.error);

    return await Config.removeValue("stores", name);
  }

  static async validatePath(name: string): Promise<Result<void>> {
    const store = await Store.get(name);
    if (store.isError()) return Err(store.error);

    const existsResult = await Fs.isDirectory(store.ok.path);

    if (existsResult.isError()) return Err(existsResult.error);
    if (!existsResult.ok) {
      return ErrFromText(`Store path is not a directory: ${store.ok.path}`);
    }
    return Ok(undefined);
  }
}

export { AddStoreError, CreateStoreError, Store };
