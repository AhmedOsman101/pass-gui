import { os } from "@neutralinojs/lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AllowedCommand } from "@/types";
import { Neu, NeutralinoService } from "./neutralino";

describe("Neu.exec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes a command and returns the result", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 12_345,
      stdOut: "output",
      stdErr: "",
      exitCode: 0,
    });

    const result = await Neu.exec({ cmd: "which", args: ["gpg"] });

    expect(result.isError()).toBe(false);
    expect(result.ok).toBeDefined();
    expect(result.ok?.pid).toBe(12_345);
    expect(result.ok?.stdOut).toBe("output");
    expect(result.ok?.exitCode).toBe(0);
  });

  it("calls os.execCommand with a quoted command string", async () => {
    const spy = vi.mocked(os.execCommand).mockResolvedValue({
      pid: 12_345,
      stdOut: "",
      stdErr: "",
      exitCode: 0,
    });

    await Neu.exec({ cmd: "which", args: ["gpg"] });

    expect(spy).toHaveBeenCalledOnce();
    const calledWith = spy.mock.calls[0]?.[0] as string;
    expect(calledWith).toContain("which");
    expect(calledWith).toContain("gpg");
  });

  it("returns error for empty command", async () => {
    const result = await Neu.exec({ cmd: "" });

    expect(result.isError()).toBe(true);
  });

  it("returns error for arguments with null bytes", async () => {
    const result = await Neu.exec({
      cmd: "which",
      args: ["bad\0arg"],
    });

    expect(result.isError()).toBe(true);
  });

  it("returns error for arguments with newlines", async () => {
    const result = await Neu.exec({
      cmd: "which",
      args: ["bad\narg"],
    });

    expect(result.isError()).toBe(true);
  });

  it("returns error when command starts with a dash", async () => {
    const result = await Neu.exec({ cmd: "-which" });

    expect(result.isError()).toBe(true);
  });

  it("returns error on non-zero exit code", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "not found",
      exitCode: 1,
    });

    const result = await Neu.exec({
      cmd: "which",
      args: ["nonexistent"],
    });

    expect(result.isError()).toBe(true);
  });

  it("strips ANSI escape codes from stdout", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 12_345,
      stdOut: "\x1b[32mgreen\x1b[0m",
      stdErr: "",
      exitCode: 0,
    });

    const result = await Neu.exec({ cmd: "echo", args: ["test"] });

    expect(result.isError()).toBe(false);
    expect(result.ok?.stdOut).toBe("green");
  });

  it("strips ANSI escape codes from stderr", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 12_345,
      stdOut: "",
      stdErr: "\x1b[31merror\x1b[0m",
      exitCode: 1,
    });

    const result = await Neu.exec({ cmd: "false" });

    expect(result.isError()).toBe(true);
  });

  it("returns error when NeutralinoJS throws", async () => {
    vi.mocked(os.execCommand).mockRejectedValue({
      code: "NE_RT_NATRTER",
      message: "Native method failed",
    });

    const result = await Neu.exec({ cmd: "which", args: ["gpg"] });

    expect(result.isError()).toBe(true);
  });

  it("passes options through to os.execCommand", async () => {
    const spy = vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "",
      stdErr: "",
      exitCode: 0,
    });

    const options = { envs: { FOO: "bar" } };
    await Neu.exec({
      cmd: "which",
      args: ["gpg"],
      options,
    });

    expect(spy).toHaveBeenCalledWith(expect.any(String), options);
  });
});

describe("Neu.safeExec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes an allowed command", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "/usr/bin/gpg",
      stdErr: "",
      exitCode: 0,
    });

    const result = await Neu.safeExec({ cmd: "which", args: ["gpg"] });

    expect(result.isError()).toBe(false);
    expect(result.ok?.exitCode).toBe(0);
  });

  it("allows 'gpg' command through safeExec", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "",
      stdErr: "",
      exitCode: 0,
    });

    const result = await Neu.safeExec({ cmd: "pass" });

    expect(result.isError()).toBe(false);
  });

  it("rejects a command not in the allowed list", async () => {
    const result = await Neu.safeExec({
      cmd: "rm" as AllowedCommand,
      args: ["-rf", "/"],
    });

    expect(result.isError()).toBe(true);
  });

  it("rejects a dangerous command like sudo", async () => {
    const result = await Neu.safeExec({
      cmd: "sudo" as AllowedCommand,
    });

    expect(result.isError()).toBe(true);
  });
});

describe("Neu.getEnv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the environment variable value", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("/home/user");

    const value = await Neu.getEnv("HOME");

    expect(value).toBe("/home/user");
  });

  it("returns the provided default when env variable is empty", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("");

    const value = await Neu.getEnv("MY_VAR", "fallback");

    expect(value).toBe("fallback");
  });

  it("returns empty string as default when no default is given", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("");

    const value = await Neu.getEnv("UNDEFINED_VAR");

    expect(value).toBe("");
  });

  it("coerces non-string default values to string", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("");

    const value = await Neu.getEnv("TIMEOUT", 30);

    expect(value).toBe("30");
  });
});

describe("Neu.commandExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when command exists on Linux (which succeeds)", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "/usr/bin/gpg",
      stdErr: "",
      exitCode: 0,
    });

    const result = await Neu.commandExists("gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns false when command does not exist on Linux", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "not found",
      exitCode: 1,
    });

    const result = await Neu.commandExists("nonexistent");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("returns false when which command errors", async () => {
    vi.mocked(os.execCommand).mockRejectedValue({
      code: "NE_RT_NATRTER",
      message: "Native method failed",
    });

    const result = await Neu.commandExists("gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });
});

describe("Neu.commandExists (Windows)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses where.exe on Windows and returns true when found", async () => {
    const winNeu = new NeutralinoService();
    winNeu.OS = "Windows" as unknown as typeof winNeu.OS;

    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "C:\\tools\\gpg.exe",
      stdErr: "",
      exitCode: 0,
    });

    const result = await winNeu.commandExists("gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns false when where.exe fails on Windows", async () => {
    const winNeu = new NeutralinoService();
    winNeu.OS = "Windows" as unknown as typeof winNeu.OS;

    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "INFO: Could not find files",
      exitCode: 1,
    });

    const result = await winNeu.commandExists("nonexistent");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });
});

describe("Neu.resolveBinaryPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves binary path on Linux with readlink following symlinks", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/local/bin/gpg",
        stdErr: "",
        exitCode: 0,
      });

    const result = await Neu.resolveBinaryPath("gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/usr/local/bin/gpg");
  });

  it("returns which result when readlink fails", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 0,
        stdOut: "",
        stdErr: "readlink failed",
        exitCode: 1,
      });

    const result = await Neu.resolveBinaryPath("gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/usr/bin/gpg");
  });

  it("returns which result when readlink returns same path", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      });

    const result = await Neu.resolveBinaryPath("gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("/usr/bin/gpg");
  });

  it("returns error when which output is empty", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/bin/gpg",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "  ",
        stdErr: "",
        exitCode: 0,
      });

    const result = await Neu.resolveBinaryPath("gpg");

    expect(result.isError()).toBe(true);
  });

  it("returns error when command is not found", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "not found",
      exitCode: 1,
    });

    const result = await Neu.resolveBinaryPath("nonexistent");

    expect(result.isError()).toBe(true);
  });

  it("returns error when which itself errors", async () => {
    vi.mocked(os.execCommand).mockRejectedValue({
      code: "NE_RT_NATRTER",
      message: "Native method failed",
    });

    const result = await Neu.resolveBinaryPath("gpg");

    expect(result.isError()).toBe(true);
  });
});

describe("Neu.resolveBinaryPath (Windows)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves binary path on Windows using where.exe", async () => {
    const winNeu = new NeutralinoService();
    winNeu.OS = "Windows" as unknown as typeof winNeu.OS;

    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "C:\\Program Files\\Gpg4win\\bin\\gpg.exe",
        stdErr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "C:\\Program Files\\Gpg4win\\bin\\gpg.exe",
        stdErr: "",
        exitCode: 0,
      });

    const result = await winNeu.resolveBinaryPath("gpg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("C:\\Program Files\\Gpg4win\\bin\\gpg.exe");
  });

  it("returns error when where.exe fails on Windows", async () => {
    const winNeu = new NeutralinoService();
    winNeu.OS = "Windows" as unknown as typeof winNeu.OS;

    vi.mocked(os.execCommand).mockRejectedValue({
      code: "NE_RT_NATRTER",
      message: "Native method failed",
    });

    const result = await winNeu.resolveBinaryPath("gpg");

    expect(result.isError()).toBe(true);
  });
});
