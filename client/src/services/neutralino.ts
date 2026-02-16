import {
  type ExecCommandOptions,
  type ExecCommandResult,
  OperatingSystem,
  os,
} from "@neutralinojs/lib";
import { ErrFromText, Ok, type Result, wrapAsyncThrowable } from "lib-result";
import stripAnsi from "strip-ansi";
import { escapeShellArg } from "@/lib/utils";
import type { Stringifiable } from "@/types";

class NeutralinoService {
  public OS: OperatingSystem = window.NL_OS;
  public HOME_DIR = "";

  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    this.HOME_DIR = await this.getHomeDir();
    this.initialized = true;
  }

  async execCommand(
    command: string,
    args?: Stringifiable[],
    options?: ExecCommandOptions
  ): Promise<Result<ExecCommandResult>> {
    const wrappedExec = wrapAsyncThrowable(
      async (
        cmd: string,
        cmdArgs?: Stringifiable[],
        cmdOptions?: ExecCommandOptions
      ) => {
        const argString = cmdArgs?.map(escapeShellArg).join(" ") ?? "";
        const fullCmd = argString ? `${cmd} ${argString}` : cmd;

        const result = await os.execCommand(fullCmd, cmdOptions);
        result.stdOut = stripAnsi(result.stdOut);
        result.stdErr = stripAnsi(result.stdErr);

        if (result.exitCode !== 0) {
          throw new Error(
            `Command failed with exit code ${result.exitCode}${result.stdErr.length ? `\n${result.stdErr}` : ""}`
          );
        }

        return result;
      }
    );

    return await wrappedExec(command, args, options);
  }

  async getEnv(key: string, defaultValue: Stringifiable = ""): Promise<string> {
    const value = await os.getEnv(key);
    // If the value is empty, use the default
    return value === "" ? String(defaultValue) : value;
  }

  async getHomeDir(): Promise<string> {
    switch (this.OS) {
      case OperatingSystem.Linux:
      case OperatingSystem.Darwin:
      case OperatingSystem.FreeBSD:
        return await this.getEnv("HOME");
      case OperatingSystem.Windows:
        return await this.getEnv("USERPROFILE");
      default:
        throw new Error(
          "Unable to locate home directory. Please set the HOME (Unix) or USERPROFILE (Windows) environment variable."
        );
    }
  }

  async commandExists(program: string): Promise<Result<boolean>> {
    let checkingProgram: string;
    switch (this.OS) {
      case OperatingSystem.Linux:
      case OperatingSystem.Darwin:
      case OperatingSystem.FreeBSD:
        checkingProgram = "which";
        break;
      case OperatingSystem.Windows:
        checkingProgram = "where.exe";
        break;
      default:
        return ErrFromText("Unknown Operating System");
    }

    const result = await this.execCommand(checkingProgram, [program]);
    if (result.isError()) return Ok(false);

    return Ok(result.ok.exitCode === 0);
  }
}

export { NeutralinoService };
