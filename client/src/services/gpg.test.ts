import { debug, os } from "@neutralinojs/lib";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GpgService } from "./gpg";
import { Neu } from "./neutralino";

const Gpg2Found = {
  pid: 1,
  stdOut: "/usr/bin/gpg2",
  stdErr: "",
  exitCode: 0,
} as const;

const GpgFound = {
  pid: 1,
  stdOut: "/usr/bin/gpg",
  stdErr: "",
  exitCode: 0,
} as const;

const NotFound = {
  pid: 0,
  stdOut: "",
  stdErr: "not found",
  exitCode: 1,
} as const;

const GpgVersionOutput = [
  "gpg (GnuPG) 2.4.5",
  "Copyright (C) 2024 Free Software Foundation, Inc.",
  "Home: /home/user/.gnupg",
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("constructor", () => {
  it("starts with default state", () => {
    const gpg = new GpgService();
    expect(gpg.command).toBe("");
    expect(gpg.version).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(gpg.homeDir).toBe("");
  });
});

describe("setHome", () => {
  it("sets the homeDir value", () => {
    const gpg = new GpgService();
    gpg.setHome("/custom/gnupg");
    expect(gpg.homeDir).toBe("/custom/gnupg");
  });
});

describe("init", () => {
  it("happy path: gpg2 found, GNUPGHOME set", async () => {
    vi.mocked(os.execCommand).mockResolvedValue(Gpg2Found);
    vi.mocked(os.getEnv).mockResolvedValue("/home/user/.gnupg");

    const gpg = new GpgService();
    const result = await gpg.init();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(gpg.command).toBe("gpg2");
    expect(gpg.homeDir).toBe("/home/user/.gnupg");
  });

  it("sets command when gpg2 found but GNUPGHOME not set", async () => {
    vi.mocked(os.execCommand).mockResolvedValue(Gpg2Found);
    vi.mocked(os.getEnv).mockResolvedValue("");

    const gpg = new GpgService();
    const result = await gpg.init();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(gpg.command).toBe("gpg2");
    expect(gpg.homeDir).toBe("");
  });

  it("returns Ok(false) when no gpg binary exists", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce(NotFound)
      .mockResolvedValueOnce(NotFound);

    const gpg = new GpgService();
    const result = await gpg.init();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
    expect(gpg.command).toBe("");
  });
});

describe("gpgExists", () => {
  it("finds gpg2 first", async () => {
    vi.mocked(os.execCommand).mockResolvedValue(Gpg2Found);

    const gpg = new GpgService();
    const result = await gpg.gpgExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(gpg.command).toBe("gpg2");
  });

  it("falls back to gpg when gpg2 is not found", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce(NotFound)
      .mockResolvedValueOnce(GpgFound);

    const gpg = new GpgService();
    const result = await gpg.gpgExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(gpg.command).toBe("gpg");
  });

  it("returns Ok(false) when neither gpg2 nor gpg exists", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce(NotFound)
      .mockResolvedValueOnce(NotFound);

    const gpg = new GpgService();
    const result = await gpg.gpgExists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
    expect(gpg.command).toBe("");
  });

  describe("on Windows", () => {
    const originalOS = Neu.OS;

    afterAll(() => {
      Neu.OS = originalOS;
    });

    beforeEach(() => {
      Neu.OS = "Windows" as typeof Neu.OS;
    });

    it("falls back to gpg2.exe when bare names fail", async () => {
      vi.mocked(os.execCommand)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce({
          pid: 1,
          stdOut: "C:\\tools\\gpg2.exe",
          stdErr: "",
          exitCode: 0,
        });

      const gpg = new GpgService();
      const result = await gpg.gpgExists();

      expect(result.isOk()).toBe(true);
      expect(result.ok).toBe(true);
      expect(gpg.command).toBe("gpg2");
    });

    it("falls back to gpg.exe when gpg2.exe also not found", async () => {
      vi.mocked(os.execCommand)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce({
          pid: 1,
          stdOut: "C:\\tools\\gpg.exe",
          stdErr: "",
          exitCode: 0,
        });

      const gpg = new GpgService();
      const result = await gpg.gpgExists();

      expect(result.isOk()).toBe(true);
      expect(result.ok).toBe(true);
      expect(gpg.command).toBe("gpg");
    });

    it("returns Ok(false) when no gpg binary on Windows", async () => {
      vi.mocked(os.execCommand)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce(NotFound)
        .mockResolvedValueOnce(NotFound);

      const gpg = new GpgService();
      const result = await gpg.gpgExists();

      expect(result.isOk()).toBe(true);
      expect(result.ok).toBe(false);
      expect(gpg.command).toBe("");
    });
  });
});

describe("checkVersion", () => {
  it("parses version 2.4.5 as valid against >=2.1", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: GpgVersionOutput,
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.checkVersion();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.valid).toBe(true);
    expect(gpg.version).toEqual({ major: 2, minor: 4, patch: 5 });
  });

  it("detects version 2.0.30 as too old", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "gpg (GnuPG) 2.0.30\n",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.checkVersion();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.valid).toBe(false);
  });

  it("leaves version at 0.0.0 when regex does not match", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "unexpected output without version pattern\n",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.checkVersion();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.valid).toBe(false);
    expect(gpg.version).toEqual({ major: 0, minor: 0, patch: 0 });
  });

  it("returns error when gpg --version exits non-zero", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "gpg: error: something went wrong",
      exitCode: 2,
    });

    const gpg = new GpgService();
    const result = await gpg.checkVersion();

    expect(result.isError()).toBe(true);
  });

  it("parses Home: line when homeDir not already set", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "gpg (GnuPG) 2.4.5\nHome: /custom/gnupg\n",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    await gpg.checkVersion();

    expect(gpg.homeDir).toBe("/custom/gnupg");
  });

  it("does not override homeDir if already set", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "gpg (GnuPG) 2.4.5\nHome: /other/gnupg\n",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    gpg.setHome("/already/set");
    await gpg.checkVersion();

    expect(gpg.homeDir).toBe("/already/set");
  });

  it("logs version and home at debug level", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: GpgVersionOutput,
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    await gpg.checkVersion();

    expect(debug.log).toHaveBeenCalledWith(
      expect.stringContaining("GPG found: gpg v2.4.5")
    );
  });
});

describe("validateGpgBinary", () => {
  it("resolves binary path successfully", async () => {
    vi.mocked(os.execCommand)
      .mockResolvedValueOnce(GpgFound)
      .mockResolvedValueOnce(GpgFound)
      .mockResolvedValueOnce({
        pid: 1,
        stdOut: "/usr/local/bin/gpg",
        stdErr: "",
        exitCode: 0,
      });

    const gpg = new GpgService();
    const result = await gpg.validateGpgBinary();

    expect(result.isOk()).toBe(true);
    expect(result.ok?.path).toBe("/usr/local/bin/gpg");
    expect(result.ok?.command).toBe("gpg");
  });

  it("returns error when binary is not found", async () => {
    vi.mocked(os.execCommand).mockResolvedValue(NotFound);

    const gpg = new GpgService();
    const result = await gpg.validateGpgBinary();

    expect(result.isError()).toBe(true);
  });
});

describe("listSecretKeys", () => {
  const singleKeyOutput = [
    "sec:u:256:1:ABC123DEF456:1700000000:::u:::0:",
    "uid:::::::::John Doe <john@example.com>:::",
    "fpr:::::::::ABC123DEF4567890:::",
  ].join("\n");

  it("parses colon output for a single key", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: singleKeyOutput,
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.listSecretKeys();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toHaveLength(1);
    expect(result.ok?.[0]?.keyId).toBe("ABC123DEF456");
    expect(result.ok?.[0]?.userId).toBe("John Doe <john@example.com>");
    expect(result.ok?.[0]?.fingerprint).toBe("ABC123DEF4567890");
    expect(result.ok?.[0]?.algorithm).toBe("1");
  });

  it("parses multiple keys", async () => {
    const multiKeyOutput = [
      "sec:u:256:1:KEY0001AAA:1700000000:::u:::0:",
      "uid:::::::::Alice <alice@example.com>:::",
      "sec:u:256:1:KEY0002BBB:1700000000:::u:::0:",
      "uid:::::::::Bob <bob@example.com>:::",
    ].join("\n");

    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: multiKeyOutput,
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.listSecretKeys();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toHaveLength(2);
    expect(result.ok![0]!.keyId).toBe("KEY0001AAA");
    expect(result.ok![1]!.keyId).toBe("KEY0002BBB");
  });

  it("returns empty array for empty output", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.listSecretKeys();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toEqual([]);
  });

  it("returns error when exit code is non-zero", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "gpg: no secret keys",
      exitCode: 2,
    });

    const gpg = new GpgService();
    const result = await gpg.listSecretKeys();

    expect(result.isError()).toBe(true);
  });
});

describe("listSecretKeysWithHome", () => {
  it("passes GNUPGHOME env and parses keys", async () => {
    const spy = vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: [
        "sec:u:256:1:DEF456ABC:1700000000:::u:::0:",
        "uid:::::::::Jane <jane@example.com>:::",
      ].join("\n"),
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.listSecretKeysWithHome("/custom/gnupg");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toHaveLength(1);
    expect(result.ok![0]!.keyId).toBe("DEF456ABC");
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ envs: { GNUPGHOME: "/custom/gnupg" } })
    );
  });

  it("returns error when exit code is non-zero", async () => {
    vi.mocked(os.execCommand).mockResolvedValue({
      pid: 0,
      stdOut: "",
      stdErr: "error",
      exitCode: 1,
    });

    const gpg = new GpgService();
    const result = await gpg.listSecretKeysWithHome("/custom/gnupg");

    expect(result.isError()).toBe(true);
  });
});

describe("exec", () => {
  it("passes GNUPGHOME env when homeDir is set", async () => {
    const spy = vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "result",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    gpg.setHome("/home/user/.gnupg");
    const result = await gpg.exec(["--decrypt", "file.gpg"]);

    expect(result.isOk()).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ envs: { GNUPGHOME: "/home/user/.gnupg" } })
    );
  });

  it("does not set GNUPGHOME when homeDir is empty", async () => {
    const spy = vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "result",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    const result = await gpg.exec(["--decrypt", "file.gpg"]);

    expect(result.isOk()).toBe(true);
    expect(spy).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it("passes additional options alongside GNUPGHOME", async () => {
    const spy = vi.mocked(os.execCommand).mockResolvedValue({
      pid: 1,
      stdOut: "result",
      stdErr: "",
      exitCode: 0,
    });

    const gpg = new GpgService();
    gpg.setHome("/home/user/.gnupg");
    const result = await gpg.exec(["--version"], {
      envs: { EXTRA: "value" },
    });

    expect(result.isOk()).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ envs: { GNUPGHOME: "/home/user/.gnupg" } })
    );
  });
});
