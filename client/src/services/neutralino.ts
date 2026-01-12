import { type ExecCommandOptions, os } from "@neutralinojs/lib";
import { wrapAsyncThrowable } from "lib-result";
import stripAnsi from "strip-ansi";

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
        result.stdErr || `Command failed with exit code ${result.exitCode}`
      );
    }

    return result;
  }
);

export { execCommand };
