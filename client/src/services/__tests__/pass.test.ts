import { filesystem, os } from "@neutralinojs/lib";
import { ErrFromText, Ok, type Result } from "lib-result";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Config } from "@/services/config";
import { Gpg } from "@/services/gpg";
import type { AppConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";
import { Neu } from "../neutralino";
import { PassService } from "../pass";

vi.mock("@/services/config", () => ({
  Config: {
    load: vi.fn(() => Promise.resolve(ErrFromText("not found"))),
    getValue: vi.fn(),
    setValue: vi.fn(),
  },
}));

vi.mock("@/services/gpg", () => ({
  Gpg: {
    homeDir: "",
  },
  gpgInitialized: Promise.resolve(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (Gpg as { homeDir: string }).homeDir = "";
});

describe("constructor", () => {
  it("starts with default state", () => {
    const pass = new PassService();
    expect(pass.storeDirectory).toBe("");
    expect(pass.isInitialized).toBe(false);
    expect(pass.version).toEqual({ major: 0, minor: 0, patch: 0 });
  });
});

describe("setStorePath", () => {
  it("sets storeDirectory value", () => {
    const pass = new PassService();
    pass.setStorePath("/custom/store");
    expect(pass.storeDirectory).toBe("/custom/store");
  });
});

describe("init", () => {
  it("uses PASSWORD_STORE_DIR env when set and .gpg-id exists", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("/custom/store");

    const pass = new PassService();
    const result = await pass.init();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(pass.storeDirectory).toBe("/custom/store");
    expect(pass.isInitialized).toBe(true);
  });

  it("fallbacks to HOME_DIR/.password-store when no env set", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("");

    const pass = new PassService();
    const result = await pass.init();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(pass.storeDirectory).toBe("/home/user/.password-store");
    expect(pass.isInitialized).toBe(true);
  });

  it("returns Ok(true) with isInitialized=false when .gpg-id does not exist", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("/custom/store");
    vi.mocked(filesystem.getStats).mockResolvedValue({
      size: 0,
      isFile: false,
      isDirectory: false,
      createdAt: 0,
      modifiedAt: 0,
    });

    const pass = new PassService();
    const result = await pass.init();

    expect(result.isOk()).toBe(true);
    expect(pass.isInitialized).toBe(false);
  });

  it("returns Ok(false) when .gpg-id check errors", async () => {
    vi.mocked(os.getEnv).mockResolvedValue("/custom/store");
    vi.mocked(filesystem.getStats).mockRejectedValue(new Error("not found"));

    const pass = new PassService();
    const result = await pass.init();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
    expect(pass.isInitialized).toBe(false);
  });
});

describe("checkVersion", () => {
  it("parses pass v1.7.4 correctly as valid", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "pass v1.7.4\n",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    const result = await pass.checkVersion();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.valid).toBe(true);
    expect(pass.version).toEqual({ major: 1, minor: 7, patch: 4 });
  });

  it("detects version 1.6.0 as too old", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "pass v1.6.0\n",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    const result = await pass.checkVersion();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.valid).toBe(false);
    expect(pass.version).toEqual({ major: 1, minor: 6, patch: 0 });
  });

  it("returns error when pass --version exits non-zero", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "pass: error",
      exitCode: 2,
    });

    const pass = new PassService();
    const result = await pass.checkVersion();

    expect(result.isError()).toBe(true);
  });

  it("leaves version at 0.0.0 when output has no version pattern", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "unexpected output without version\n",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    const result = await pass.checkVersion();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.valid).toBe(false);
    expect(pass.version).toEqual({ major: 0, minor: 0, patch: 0 });
  });
});

describe("validatePassBinary", () => {
  it("resolves system binary path under /usr/bin", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "/usr/bin/pass",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    const result = await pass.validatePassBinary();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.path).toBe("/usr/bin/pass");
    expect(result.ok?.isSystemBinary).toBe(true);
  });

  it("detects custom script path as non-system binary", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "/usr/local/bin/pass",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    const result = await pass.validatePassBinary();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.path).toBe("/usr/local/bin/pass");
    expect(result.ok?.isSystemBinary).toBe(false);
  });

  it("returns error when binary cannot be resolved", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "not found",
      exitCode: 1,
    });

    const pass = new PassService();
    const result = await pass.validatePassBinary();

    expect(result.isError()).toBe(true);
  });
});

describe("passExists", () => {
  it("returns Ok(true) when pass is found and binary validates", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "/usr/bin/pass",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    const result = await pass.passExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns Ok(false) when pass is not found", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "not found",
      exitCode: 1,
    });

    const pass = new PassService();
    const result = await pass.passExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });
});

describe("passExists (Windows)", () => {
  const originalOS = Neu.OS;

  afterAll(() => {
    Neu.OS = originalOS;
  });

  beforeEach(() => {
    Neu.OS = "Windows" as typeof Neu.OS;
  });

  it("falls back to pass.cmd when bare pass is not found", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 0,
        stdOut: "",
        stdErr: "not found",
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "C:\\tools\\pass.cmd",
        stdErr: "",
        exitCode: 0,
      });

    const pass = new PassService();
    const result = await pass.passExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("falls back to pass.ps1 when both pass and pass.cmd are missing", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 0,
        stdOut: "",
        stdErr: "not found",
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        pid: 0,
        stdOut: "",
        stdErr: "not found",
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "C:\\tools\\pass.ps1",
        stdErr: "",
        exitCode: 0,
      });

    const pass = new PassService();
    const result = await pass.passExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns Ok(false) when no pass variant found on Windows", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce({
        pid: 0,
        stdOut: "",
        stdErr: "not found",
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        pid: 0,
        stdOut: "",
        stdErr: "not found",
        exitCode: 1,
      })
      .mockResolvedValueOnce({
        pid: 0,
        stdOut: "",
        stdErr: "not found",
        exitCode: 1,
      });

    const pass = new PassService();
    const result = await pass.passExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });
});

describe("exec", () => {
  it("executes pass command with PASSWORD_STORE_DIR env", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "password-content",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    pass.setStorePath("/home/user/.password-store");
    const result = await pass.exec(["show", "Email/work"]);

    expect(result.isOk()).toBe(true);
    expect(os.execCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        envs: { PASSWORD_STORE_DIR: "/home/user/.password-store" },
      })
    );
  });

  it("sets GNUPGHOME env when Gpg.homeDir is set", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "data",
      stdErr: "",
      exitCode: 0,
    });

    (Gpg as { homeDir: string }).homeDir = "/home/user/.gnupg";

    const pass = new PassService();
    pass.setStorePath("/home/user/.password-store");
    const result = await pass.exec(["show", "Email/work"]);

    expect(result.isOk()).toBe(true);
    expect(os.execCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        envs: {
          PASSWORD_STORE_DIR: "/home/user/.password-store",
          GNUPGHOME: "/home/user/.gnupg",
        },
      })
    );
  });

  it("does not set GNUPGHOME when Gpg.homeDir is empty", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "data",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    pass.setStorePath("/home/user/.password-store");
    await pass.exec(["show", "Email/work"]);

    const calledOptions = vi.mocked(os.execCommand).mock.calls[0]?.[1] as
      | { envs?: Record<string, string> }
      | undefined;
    expect(calledOptions?.envs?.GNUPGHOME).toBeUndefined();
  });

  it("rejects invalid store directory with sneaky path", async () => {
    const pass = new PassService();
    pass.setStorePath("/../etc");
    const result = await pass.exec(["show", "test"]);

    expect(result.isError()).toBe(true);
  });

  it("rejects path traversal in arguments", async () => {
    const pass = new PassService();
    pass.setStorePath("/home/user/.password-store");
    const result = await pass.exec(["show", "../../etc/passwd"]);

    expect(result.isError()).toBe(true);
  });

  it("merges caller-provided envs on top of defaults", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "data",
      stdErr: "",
      exitCode: 0,
    });

    const pass = new PassService();
    pass.setStorePath("/home/user/.password-store");
    const result = await pass.exec(["show", "Email/work"], {
      envs: { EXTRA: "value" },
    });

    expect(result.isOk()).toBe(true);
    expect(os.execCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        envs: {
          PASSWORD_STORE_DIR: "/home/user/.password-store",
          EXTRA: "value",
        },
      })
    );
  });

  it("loads gpg.opts from Config and sets PASSWORD_STORE_GPG_OPTS", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "data",
      stdErr: "",
      exitCode: 0,
    });

    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: { gpg: { opts: ["--batch", "--no-tty"] } },
        _raw: {},
      }) as unknown as Result<ParsedToml<AppConfig>>
    );

    const pass = new PassService();
    pass.setStorePath("/home/user/.password-store");
    const result = await pass.exec(["show", "Email/work"]);

    expect(result.isOk()).toBe(true);
    expect(os.execCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        envs: {
          PASSWORD_STORE_DIR: "/home/user/.password-store",
          PASSWORD_STORE_GPG_OPTS: "--batch --no-tty",
        },
      })
    );
  });

  it("does not set PASSWORD_STORE_GPG_OPTS when gpg.opts is empty", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "data",
      stdErr: "",
      exitCode: 0,
    });

    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: { gpg: { opts: [] } },
        _raw: {},
      }) as unknown as Result<ParsedToml<AppConfig>>
    );

    const pass = new PassService();
    pass.setStorePath("/home/user/.password-store");
    await pass.exec(["show", "Email/work"]);

    const calledOptions = vi.mocked(os.execCommand).mock.calls[0]?.[1] as
      | { envs?: Record<string, string> }
      | undefined;
    expect(calledOptions?.envs?.PASSWORD_STORE_GPG_OPTS).toBeUndefined();
  });
});
