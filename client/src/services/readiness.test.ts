import { describe, it, expect, vi, beforeEach } from "vitest";
import { Ok, Err } from "lib-result";
import { CommandFailedError } from "@/lib/errors";
import { Readiness } from "./readiness";
import { Pass } from "@/services/pass";
import { Neu } from "@/services/neutralino";
import { Gpg } from "@/services/gpg";
import { Fs } from "@/services/filesystem";
import { StoreValidation } from "@/services/store-validation";
import { Config } from "@/services/config";

vi.mock("@/services/pass", () => ({
  Pass: {
    passExists: vi.fn(),
    checkVersion: vi.fn(),
    exec: vi.fn(),
  },
  PassService: vi.fn(),
}));

vi.mock("@/services/neutralino", () => ({
  Neu: {
    commandExists: vi.fn(),
    OS: "Linux" as string,
  },
  NeutralinoService: vi.fn(),
}));

vi.mock("@/services/gpg", () => ({
  Gpg: {
    gpgExists: vi.fn(),
    listSecretKeys: vi.fn(),
  },
  GpgService: vi.fn(),
}));

vi.mock("@/services/filesystem", () => ({
  Fs: {
    exists: vi.fn(),
    isDirectory: vi.fn(),
    join: vi.fn((...paths: string[]) => Promise.resolve(paths.join("/"))),
  },
  Filesystem: class {},
}));

vi.mock("@/services/store-validation", () => ({
  StoreValidation: {
    parseGpgId: vi.fn(),
    verifyRecipients: vi.fn(),
    hasEntries: vi.fn(),
  },
}));

vi.mock("@/services/config", () => ({
  Config: {
    load: vi.fn(),
  },
}));

const STORE_PATH = "/home/user/.password-store";
const VALID_VERSION = {
  valid: true,
  found: { major: 1, minor: 7, patch: 4 },
  expected: { major: 1, minor: 7, patch: 0 },
};
const OLD_VERSION = {
  valid: false,
  found: { major: 1, minor: 6, patch: 0 },
  expected: { major: 1, minor: 7, patch: 0 },
};
const SECRET_KEY = { keyId: "DEADBEEF1234", fingerprint: "ABCD1234..." } as any;

beforeEach(() => {
  vi.clearAllMocks();
  (Neu as { OS: string }).OS = "Linux";

  vi.mocked(Pass.passExists).mockResolvedValue(Ok(true));
  vi.mocked(Pass.checkVersion).mockResolvedValue(Ok(VALID_VERSION));
  vi.mocked(Neu.commandExists).mockResolvedValue(Ok(true));
  vi.mocked(Gpg.gpgExists).mockResolvedValue(Ok(true));
  vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([SECRET_KEY]));
  vi.mocked(Fs.exists).mockResolvedValue(Ok(true));
  vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(true));
  vi.mocked(StoreValidation.parseGpgId).mockResolvedValue(
    Ok([{ raw: "DEADBEEF1234", keyId: "DEADBEEF1234", isFingerprint: false }]),
  );
  vi.mocked(StoreValidation.verifyRecipients).mockResolvedValue(
    Ok({ recipients: [], missingKeys: [] }),
  );
  vi.mocked(Pass.exec).mockResolvedValue(
    Ok({ pid: 1, stdOut: "", stdErr: "", exitCode: 0 }),
  );
  vi.mocked(StoreValidation.hasEntries).mockResolvedValue(Ok(true));
  vi.mocked(Config.load).mockResolvedValue(
    Err(new Error("config not found")),
  );
});

describe("check", () => {
  it("returns READY state with no issues when all checks pass", async () => {
    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("READY");
    expect(result.issues).toHaveLength(0);
    expect(result.evaluatedAt).toBeGreaterThan(0);
  });

  it("returns STORE_EMPTY with STORE_NO_ENTRIES when store has no entries", async () => {
    vi.mocked(StoreValidation.hasEntries).mockResolvedValue(Ok(false));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_EMPTY");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_NO_ENTRIES");
    expect(result.issues[0]!.severity).toBe("info");
  });

  it("returns NEED_PASS when pass binary is missing", async () => {
    vi.mocked(Pass.passExists).mockResolvedValue(Ok(false));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("NEED_PASS");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("PASS_BINARY_MISSING");
  });

  it("returns NEED_PASS when passExists errors", async () => {
    vi.mocked(Pass.passExists).mockResolvedValue(Err(new Error("oops")));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("NEED_PASS");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("PASS_BINARY_MISSING");
  });

  it("returns NEED_PASS when checkVersion errors", async () => {
    vi.mocked(Pass.checkVersion).mockResolvedValue(Err(new Error("oops")));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("NEED_PASS");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("PASS_BINARY_MISSING");
  });

  it("returns NEED_PASS with PASS_VERSION_TOO_OLD when version is too old", async () => {
    vi.mocked(Pass.checkVersion).mockResolvedValue(Ok(OLD_VERSION));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("NEED_PASS");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("PASS_VERSION_TOO_OLD");
    const issue = result.issues[0] as Extract<
      typeof result.issues[number],
      { code: "PASS_VERSION_TOO_OLD" }
    >;
    expect(issue.found).toEqual({ major: 1, minor: 6, patch: 0 });
    expect(issue.expected).toEqual({ major: 1, minor: 7, patch: 0 });
  });

  it("returns NEED_TREE when tree binary is missing on Linux", async () => {
    vi.mocked(Neu.commandExists).mockResolvedValue(Ok(false));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("NEED_TREE");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("TREE_BINARY_MISSING");
  });

  it("skips tree check on Windows and proceeds to READY", async () => {
    (Neu as { OS: string }).OS = "Windows";

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("READY");
    expect(Neu.commandExists).not.toHaveBeenCalled();
  });

  it("returns NEED_GPG when GPG binary is missing", async () => {
    vi.mocked(Gpg.gpgExists).mockResolvedValue(Ok(false));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("NEED_GPG");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("GPG_BINARY_MISSING");
  });

  it("returns GPG_NO_KEYS when no secret keys exist", async () => {
    vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([]));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("GPG_NO_KEYS");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("GPG_NO_SECRET_KEYS");
  });

  it("returns GPG_NO_KEYS when listSecretKeys errors", async () => {
    vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Err(new Error("oops")));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("GPG_NO_KEYS");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("GPG_NO_SECRET_KEYS");
  });

  it("returns STORE_NOT_FOUND when store directory does not exist", async () => {
    vi.mocked(Fs.exists).mockResolvedValueOnce(Ok(false));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_NOT_FOUND");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_DIR_NOT_FOUND");
  });

  it("returns STORE_NOT_FOUND when store path is not a directory", async () => {
    vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(false));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_NOT_FOUND");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_DIR_NOT_DIRECTORY");
  });

  it("returns STORE_NO_GPG_ID when .gpg-id file is missing", async () => {
    vi.mocked(Fs.exists)
      .mockReset()
      .mockResolvedValueOnce(Ok(true))   // store exists
      .mockResolvedValueOnce(Ok(false)); // .gpg-id missing

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_NO_GPG_ID");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_GPG_ID_MISSING");
  });

  it("returns STORE_GPG_ID_EMPTY when parseGpgId errors", async () => {
    vi.mocked(StoreValidation.parseGpgId).mockResolvedValue(
      Err(new Error("parse failed")),
    );

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_GPG_ID_EMPTY");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_GPG_ID_EMPTY");
  });

  it("returns STORE_GPG_ID_KEY_MISSING when recipients have missing keys", async () => {
    vi.mocked(StoreValidation.verifyRecipients).mockResolvedValue(
      Ok({ recipients: [], missingKeys: ["MISSINGKEY"] }),
    );

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_GPG_ID_KEY_MISSING");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_RECIPIENT_UNKNOWN");
  });

  it("returns STORE_GPG_ID_KEY_MISSING when verifyRecipients errors", async () => {
    vi.mocked(StoreValidation.verifyRecipients).mockResolvedValue(
      Err(new Error("verify failed")),
    );

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_GPG_ID_KEY_MISSING");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_GPG_ID_PARSE_ERROR");
  });

  it("returns STORE_GPG_ID_KEY_MISSING when behavioral check fails with CommandFailedError", async () => {
    vi.mocked(Pass.exec).mockResolvedValue(
      Err(
        new CommandFailedError({
          cmd: "pass",
          args: ["ls"],
          exitCode: 1,
          stdOut: "",
          stdErr: "stderr content",
          pid: 1,
        }),
      ),
    );

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_GPG_ID_KEY_MISSING");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_BEHAVIORAL_CHECK_FAILED");
  });

  it("returns STORE_GPG_ID_KEY_MISSING when behavioral check fails with generic error", async () => {
    vi.mocked(Pass.exec).mockResolvedValue(Err(new Error("generic error")));

    const result = await Readiness.check(STORE_PATH);

    expect(result.state).toBe("STORE_GPG_ID_KEY_MISSING");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.code).toBe("STORE_BEHAVIORAL_CHECK_FAILED");
  });

  it("resolves custom GNUPGHOME from config and passes it to verifyRecipients", async () => {
    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: {
          stores: {
            main: {
              path: STORE_PATH,
              gnupg_home: "/custom/gnupg",
            },
          },
        },
        _raw: {},
      } as any),
    );

    await Readiness.check(STORE_PATH);

    expect(StoreValidation.verifyRecipients).toHaveBeenCalledWith(
      expect.any(Array),
      "/custom/gnupg",
    );
  });
});
