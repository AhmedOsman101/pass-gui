vi.mock("@/services/gpg", () => ({
  Gpg: {
    listSecretKeys: vi.fn(),
    listSecretKeysWithHome: vi.fn(),
  },
}));

vi.mock("@/services/pass", () => ({
  Pass: {
    exec: vi.fn(),
    storeDirectory: "/home/user/.password-store",
  },
}));

vi.mock("@/services/filesystem", () => ({
  Fs: {
    readFile: vi.fn(),
    exists: vi.fn(),
    isFile: vi.fn(),
    isDirectory: vi.fn(),
    readDirectory: vi.fn(),
    join: vi.fn((...p: string[]) => Promise.resolve(p.join("/"))),
  },
}));

import { Err, Ok } from "lib-result";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Fs } from "@/services/filesystem";
import { Gpg } from "@/services/gpg";
import { Pass } from "@/services/pass";
import type { SecretKey } from "@/types";
import { StoreValidation } from "./store-validation";

function makeSecretKey(overrides: Partial<SecretKey> = {}): SecretKey {
  return {
    keyId: "DEADBEEF",
    fingerprint: "A1B2C3D4E5F6123456789ABC1234567890ABCDEF",
    userId: "Test User <test@example.com>",
    userIds: ["Test User <test@example.com>"],
    algorithm: "ed25519",
    creationDate: "2024-01-01",
    expirationDate: null,
    ...overrides,
  };
}

const gpgDirEntries = [
  { type: "FILE" as const, entry: "test.gpg", path: "/store/test.gpg" },
];
const noGpgDirEntries = [
  { type: "FILE" as const, entry: "test.txt", path: "/store/test.txt" },
  {
    type: "DIRECTORY" as const,
    entry: "subdir",
    path: "/store/subdir",
  },
];

describe("StoreValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseGpgId", () => {
    it("parses single key ID line from .gpg-id", async () => {
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(Ok("DEADBEEF\n"));

      const result = await StoreValidation.parseGpgId("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual([
        { raw: "DEADBEEF", keyId: "DEADBEEF", isFingerprint: false },
      ]);
    });

    it("parses 40-char hex fingerprint line", async () => {
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(
        Ok("A1B2C3D4E5F6123456789ABC1234567890ABCDEF\n")
      );

      const result = await StoreValidation.parseGpgId("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toHaveLength(1);
      expect(result.ok![0]!.isFingerprint).toBe(true);
      expect(result.ok![0]!.keyId).toBe(
        "A1B2C3D4E5F6123456789ABC1234567890ABCDEF"
      );
    });

    it("skips comment lines and blank lines", async () => {
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(
        Ok("# this is a comment\n\nDEADBEEF\n")
      );

      const result = await StoreValidation.parseGpgId("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toHaveLength(1);
      expect(result.ok![0]!.keyId).toBe("DEADBEEF");
    });

    it("strips inline comments from key ID lines", async () => {
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(
        Ok("keyId # this is an inline comment\n")
      );

      const result = await StoreValidation.parseGpgId("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual([
        {
          raw: "keyId # this is an inline comment",
          keyId: "keyId",
          isFingerprint: false,
        },
      ]);
    });

    it("returns error when no valid key IDs found", async () => {
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(Ok("# comment\n\n"));

      const result = await StoreValidation.parseGpgId("/store");

      expect(result.isError()).toBe(true);
      expect(result.error!.message).toContain("No valid key IDs found");
    });
  });

  describe("verifyRecipients", () => {
    it("returns empty missingKeys when all recipients found", async () => {
      const recipients = [
        { raw: "DEADBEEF", keyId: "DEADBEEF", isFingerprint: false },
      ];
      vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([makeSecretKey()]));

      const result = await StoreValidation.verifyRecipients(recipients);

      expect(result.isOk()).toBe(true);
      expect(result.ok!.missingKeys).toEqual([]);
    });

    it("includes missing recipients in missingKeys", async () => {
      const recipients = [
        { raw: "DEADBEEF", keyId: "DEADBEEF", isFingerprint: false },
        { raw: "MISSING", keyId: "MISSING", isFingerprint: false },
      ];
      vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([makeSecretKey()]));

      const result = await StoreValidation.verifyRecipients(recipients);

      expect(result.isOk()).toBe(true);
      expect(result.ok!.missingKeys).toEqual(["MISSING"]);
    });

    it("includes all recipients when no secret keys match", async () => {
      const recipients = [
        { raw: "UNKNOWN", keyId: "UNKNOWN", isFingerprint: false },
      ];
      vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([]));

      const result = await StoreValidation.verifyRecipients(recipients);

      expect(result.isOk()).toBe(true);
      expect(result.ok!.missingKeys).toEqual(["UNKNOWN"]);
    });

    it("calls listSecretKeysWithHome when GNUPGHOME is provided", async () => {
      const recipients = [
        { raw: "DEADBEEF", keyId: "DEADBEEF", isFingerprint: false },
      ];
      vi.mocked(Gpg.listSecretKeysWithHome).mockResolvedValue(
        Ok([makeSecretKey()])
      );

      const result = await StoreValidation.verifyRecipients(
        recipients,
        "/custom/gnupg"
      );

      expect(result.isOk()).toBe(true);
      expect(Gpg.listSecretKeysWithHome).toHaveBeenCalledWith("/custom/gnupg");
      expect(Gpg.listSecretKeys).not.toHaveBeenCalled();
    });
  });

  describe("validate", () => {
    it("returns full happy path result", async () => {
      vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(true));
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(Ok("DEADBEEF\n"));
      vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([makeSecretKey()]));
      (Fs.readDirectory as unknown as Mock).mockResolvedValue(
        Ok(gpgDirEntries)
      );

      const result = await StoreValidation.validate("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!.exists).toBe(true);
      expect(result.ok!.initialized).toBe(true);
      expect(result.ok!.hasEntries).toBe(true);
      expect(result.ok!.missingKeys).toEqual([]);
    });

    it("returns not exists when store directory missing", async () => {
      vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(false));

      const result = await StoreValidation.validate("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!.exists).toBe(false);
      expect(result.ok!.initialized).toBe(false);
    });

    it("returns not initialized when .gpg-id missing", async () => {
      vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(true));
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(false));

      const result = await StoreValidation.validate("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!.exists).toBe(true);
      expect(result.ok!.initialized).toBe(false);
    });

    it("populates missingKeys when some recipients missing", async () => {
      vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(true));
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(Ok("DEADBEEF\nMISSING\n"));
      vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([makeSecretKey()]));
      (Fs.readDirectory as unknown as Mock).mockResolvedValue(
        Ok(gpgDirEntries)
      );

      const result = await StoreValidation.validate("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!.missingKeys).toEqual(["MISSING"]);
    });

    it("returns hasEntries false when no .gpg files exist", async () => {
      vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(true));
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(Ok("DEADBEEF\n"));
      vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Ok([makeSecretKey()]));
      (Fs.readDirectory as unknown as Mock).mockResolvedValue(
        Ok(noGpgDirEntries)
      );

      const result = await StoreValidation.validate("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!.hasEntries).toBe(false);
    });

    it("propagates Fs.isDirectory error", async () => {
      const err = new Error("permission denied");
      vi.mocked(Fs.isDirectory).mockResolvedValue(Err(err));

      const result = await StoreValidation.validate("/store");

      expect(result.isError()).toBe(true);
      expect(result.error!).toBe(err);
    });

    it("propagates Gpg.listSecretKeys error", async () => {
      const err = new Error("gpg failed");
      vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(true));
      vi.mocked(Fs.isFile).mockResolvedValue(Ok(true));
      vi.mocked(Fs.readFile).mockResolvedValue(Ok("DEADBEEF\n"));
      vi.mocked(Gpg.listSecretKeys).mockResolvedValue(Err(err));

      const result = await StoreValidation.validate("/store");

      expect(result.isError()).toBe(true);
      expect(result.error!).toBe(err);
    });
  });

  describe("hasEntries", () => {
    it("returns true when .gpg files exist", async () => {
      (Fs.readDirectory as unknown as Mock).mockResolvedValue(
        Ok(gpgDirEntries)
      );

      const result = await StoreValidation.hasEntries("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toBe(true);
    });

    it("returns false when no .gpg files exist", async () => {
      (Fs.readDirectory as unknown as Mock).mockResolvedValue(
        Ok(noGpgDirEntries)
      );

      const result = await StoreValidation.hasEntries("/store");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toBe(false);
    });

    it("propagates Fs.readDirectory error", async () => {
      const err = new Error("read failed");
      (Fs.readDirectory as unknown as Mock).mockResolvedValue(Err(err));

      const result = await StoreValidation.hasEntries("/store");

      expect(result.isError()).toBe(true);
      expect(result.error!).toBe(err);
    });
  });

  describe("validateBehavior", () => {
    it("returns Ok when Pass.exec succeeds", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(
        Ok({ pid: 1, stdOut: "", stdErr: "", exitCode: 0 })
      );

      const result = await StoreValidation.validateBehavior("/store");

      expect(result.isOk()).toBe(true);
    });

    it("propagates Pass.exec error", async () => {
      const err = new Error("pass command failed");
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await StoreValidation.validateBehavior("/store");

      expect(result.isError()).toBe(true);
      expect(result.error!).toBe(err);
    });
  });
});
