import { computer, type ExecCommandOptions, os } from "@neutralinojs/lib";
import { wrapAsyncThrowable } from "lib-result";
import stripAnsi from "strip-ansi";
import type { EnvVar, OsType } from "@/types";

const execCommand = wrapAsyncThrowable(
  async (
    command: string,
    args?: (string | number)[],
    options?: ExecCommandOptions
  ) => {
    let argString = "";
    if (Array.isArray(args)) argString = ` ${args?.join(" ")}`;

    const result = await os.execCommand(`${command}${argString}`, options);

    result.stdOut = stripAnsi(result.stdOut);
    result.stdErr = stripAnsi(result.stdErr);

    if (result.exitCode !== 0) {
      throw new Error(
        `Command failed with exit code ${result.exitCode}\n${result.stdErr}`
      );
    }

    return result;
  }
);

async function getEnv(key: string, defaultValue: EnvVar = "") {
  return (await os.getEnv(key)) ?? String(defaultValue);
}

async function getHomeDir(): Promise<string> {
  const osType = (await computer.getKernelInfo()).variant as OsType;

  switch (osType) {
    case "Linux":
    case "Darwin":
      return getEnv("HOME", "~");
    case "Windows NT":
      return getEnv("USERPROFILE", "~");
    default:
      throw new Error(
        "Unable to locate home directory. Please set the HOME (Unix) or USERPROFILE (Windows) environment variable."
      );
  }
}

const neu = { execCommand, getEnv, getHomeDir };
export { neu };
