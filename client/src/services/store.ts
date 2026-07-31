import { debug } from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result } from "lib-result";
import type { StoreConfig } from "@/types/config";
import { Config } from "./config";
import { Fs } from "./filesystem";

type StoreDetails = StoreConfig & { name: string };

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

  static async create(name: string, data: StoreConfig): Promise<Result<void>> {
    const existsResult = await Store.get(name);
    await debug.log(
      `${JSON.stringify(existsResult.ok || {})} - ${existsResult.error?.message}`
    );
    if (existsResult.isOk() && existsResult.ok) {
      return ErrFromText("Store already exists.");
    }

    const storeResult = await Config.setValue("stores", name, data);
    if (storeResult.isError()) {
      return Err(storeResult.error);
    }

    return Ok(undefined);
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

export { Store };
