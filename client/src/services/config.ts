import * as TOML from "@ltd/j-toml";
import { Err, type Result, wrapAsync } from "lib-result";
import { fs } from "./filesystem";
import { neu } from "./neutralino";

class ConfigService {
  static get() {}

  static set() {
    TOML;
  }

  static async getPath() {
    return await wrapAsync(async () =>
      (
        await fs.join(await neu.getConfigDir(), "pass-gui", "config.toml")
      ).unwrap()
    );
  }

  static async exists(): Promise<Result<boolean>> {
    const configFile = await ConfigService.getPath();
    if (configFile.isError()) return Err(configFile.error);
    return await fs.exists(configFile.ok);
  }

  static async load() {
    const exists = await ConfigService.exists();
    if (exists.isError()) return Err(exists.error);

    const readConfig = await fs.readFile(
      (await ConfigService.getPath()).ok as string
    );

    if (readConfig.isError()) return Err(readConfig.error);
    const content = TOML.parse(readConfig.ok);
    return content;
  }
  static async save() {}
}

export { ConfigService };
