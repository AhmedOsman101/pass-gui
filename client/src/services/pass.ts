import { Ok, type Result } from "lib-result";
import { PASS_MIN_VERSION } from "@/lib/constants";
import { compareVersions } from "@/lib/utils";
import type { Version } from "@/types";
import { fs } from "./filesystem";
import { NeutralinoService } from "./neutralino";

class PassService {
  public storeDirectory = "";
  public isInitialized = false;
  public version: Version = { major: 0, minor: 0, patch: 0 };

  async init(): Promise<Result<boolean>> {
    const neu = new NeutralinoService();
    await neu.init();

    this.storeDirectory = await neu.getEnv(
      "PASSWORD_STORE_DIR",
      `${neu.HOME_DIR}/.password-store`
    );

    const result = await this.checkInitialized(this.storeDirectory);
    if (result.isError()) {
      this.isInitialized = false;
      return Ok(false);
    }

    this.isInitialized = result.ok;

    return Ok(true);
  }

  private async checkInitialized(storePath: string) {
    const gpgIdPath = `${storePath}/.gpg-id`;
    return await fs.exists(gpgIdPath);
  }

  checkVersion(version: Version): boolean {
    return compareVersions(version, PASS_MIN_VERSION) >= 0;
  }

  async passExists(): Promise<boolean> {
    const neu = new NeutralinoService();
    await neu.init();

    const existsResult = await neu.commandExists("pass");
    if (existsResult.isError() || !existsResult.ok) return false;

    const cmdResult = await neu.execCommand("pass", ["--version"]);
    if (cmdResult.isError() || cmdResult.ok.exitCode !== 0) return false;

    const versionMatch = cmdResult.ok.stdOut.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      this.version.major = Number.parseInt(versionMatch[1] as string, 10);
      this.version.minor = Number.parseInt(versionMatch[2] as string, 10);
      this.version.patch = Number.parseInt(versionMatch[3] as string, 10);
    }

    return this.checkVersion(this.version);
  }
}

const pass = new PassService();
export { pass, PassService };
