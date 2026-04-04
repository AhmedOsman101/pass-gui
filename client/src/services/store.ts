import { Err, Ok, type Result } from "lib-result";
import type { StoreConfig } from "@/types/config";
import { ConfigService } from "./config";
import { fs } from "./filesystem";

type StoreDetails = StoreConfig & { name: string };

class StoreService {
  static async get(name: string): Promise<Result<StoreDetails>> {
    return (await ConfigService.getValue("stores", name)).map(store => ({
      ...store,
      name,
    }));
  }

  static async set(
    name: string,
    data: Partial<StoreConfig>
  ): Promise<Result<void>> {
    const store = await StoreService.get(name);
    if (store.isError()) return Err(store.error);

    return await ConfigService.setValue("stores", name, {
      path: data.path ?? store.ok.path,
      gnupg_home: data.gnupg_home ?? store.ok.gnupg_home,
    });
  }

  static async validatePath(name: string): Promise<Result<void>> {
    const store = await StoreService.get(name);
    if (store.isError()) return Err(store.error);

    const existsResult = await fs.isDirectory(store.ok.path);

    if (existsResult.isError()) return Err(existsResult.error);
    return Ok(undefined);
  }
}

export { StoreService };
