// ---------------------------------------------------------------------------
// Integration test: Full GPG key lifecycle
//
// Requires:
//   - gnupg 2.2+ installed
//   - GNUPGHOME pointing to an ephemeral location
//   - No real keyrings or password stores
//
// Run inside the Podman container (Containerfile.test):
//   pnpm test:integration
//
// These tests exec real gpg binaries — never point them at your real
// keyring.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  useEphemeralTestRoot,
  makeTestEnv,
  generateKey,
  getKeyId,
  getFingerprint,
  run,
  testRoot,
} from "./test-utils";

describe("GPG lifecycle", () => {
  useEphemeralTestRoot();

  // -----------------------------------------------------------------------
  // 1. RSA 2048 key generation
  // -----------------------------------------------------------------------
  describe("RSA 2048 key generation", () => {
    const { env } = makeTestEnv(".gnupg-rsa");

    it("generates an RSA 2048 key from batch config", () => {
      const email = generateKey(env, { email: "rsa-test@pass-gui.local" });

      const listOutput = run("gpg --list-keys", { env });
      expect(listOutput).toContain(email);
      expect(listOutput).toContain("pub");
    });
  });

  // -----------------------------------------------------------------------
  // 2. Ed25519 key generation
  // -----------------------------------------------------------------------
  describe("Ed25519 key generation", () => {
    const { env } = makeTestEnv(".gnupg-ed25519");

    it("generates an Ed25519 key", () => {
      const gnupgHome = env.GNUPGHOME!;
      if (!existsSync(gnupgHome)) {
        mkdirSync(gnupgHome, { recursive: true, mode: 0o700 });
      }

      const batchConfig = [
        "%echo Generating Ed25519 test key",
        "Key-Type: Ed25519",
        "Name-Real: pass-gui Test",
        "Name-Email: ed25519-test@pass-gui.local",
        "Expire-Date: 0",
        "%no-protection",
        "%commit",
      ].join("\n");

      run("gpg --batch --gen-key /dev/stdin", { input: batchConfig, env });

      const colonOut = run("gpg --list-keys --with-colons", { env });
      expect(colonOut).toContain("pub:");
      expect(colonOut).toContain("ed25519");
      expect(colonOut).toContain("ed25519-test@pass-gui.local");
    });
  });

  // -----------------------------------------------------------------------
  // 3. Secret key listing (colon format)
  // -----------------------------------------------------------------------
  describe("secret key listing", () => {
    const { env } = makeTestEnv(".gnupg-seclist");

    it("lists secret keys in colon format with correct key ID length", () => {
      generateKey(env, { email: "seclist-test@pass-gui.local" });

      const colonOut = run("gpg --list-secret-keys --with-colons", { env });
      const secLine = colonOut.split("\n").find((l) => l.startsWith("sec:"));
      expect(secLine).toBeTruthy();

      const keyId = secLine!.split(":")[4];
      expect(keyId).toBeTruthy();
      expect(keyId!.length).toBe(16);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Encrypt and decrypt a file
  // -----------------------------------------------------------------------
  describe("encrypt and decrypt", () => {
    const { env } = makeTestEnv(".gnupg-crypt");

    it("encrypts and decrypts a file with the generated key", () => {
      const email = generateKey(env, { email: "crypt-test@pass-gui.local" });
      const original = "Hello GPG World!";
      const plainFile = join(testRoot, "plaintext.txt");
      writeFileSync(plainFile, original, "utf-8");

      run(`gpg --encrypt --recipient "${email}" "${plainFile}"`, { env });

      const encryptedFile = `${plainFile}.gpg`;
      expect(existsSync(encryptedFile)).toBe(true);

      const encryptedContent = readFileSync(encryptedFile);
      expect(encryptedContent.includes(original)).toBe(false);
      expect(encryptedContent.length).toBeGreaterThan(0);

      const decrypted = run(`gpg --decrypt "${encryptedFile}"`, { env });
      expect(decrypted).toBe(original);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Export and re-import
  // -----------------------------------------------------------------------
  describe("export and re-import", () => {
    const { env } = makeTestEnv(".gnupg-export");

    it("exports and re-imports a public key", () => {
      const email = generateKey(env, { email: "export-test@pass-gui.local" });

      const armoredKey = run(`gpg --export --armor "${email}"`, { env });
      expect(armoredKey).toContain("-----BEGIN PGP PUBLIC KEY BLOCK-----");

      const fingerprint = getFingerprint(env, email);

      run(
        `gpg --batch --yes --delete-secret-and-public-key "${fingerprint}"`,
        { env }
      );

      const listAfterDelete = run("gpg --list-keys", { env });
      expect(listAfterDelete).not.toContain(email);

      run("gpg --import", { input: armoredKey, env });

      const listAfterImport = run("gpg --list-keys", { env });
      expect(listAfterImport).toContain(email);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Key deletion
  // -----------------------------------------------------------------------
  describe("key deletion", () => {
    const { env } = makeTestEnv(".gnupg-delete");

    it("deleting a key removes it from both public and secret keyrings", () => {
      const email = generateKey(env, { email: "delete-test@pass-gui.local" });
      const fingerprint = getFingerprint(env, email);

      expect(run("gpg --list-keys", { env })).toContain(email);
      expect(run("gpg --list-secret-keys", { env })).toContain(email);

      run(
        `gpg --batch --yes --delete-secret-and-public-key "${fingerprint}"`,
        { env }
      );

      expect(run("gpg --list-keys", { env })).not.toContain(email);
      expect(run("gpg --list-secret-keys", { env })).not.toContain(email);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Key expiration
  // -----------------------------------------------------------------------
  describe("key expiration", () => {
    const { env } = makeTestEnv(".gnupg-expire");

    it("key expiration date is correctly parsed", () => {
      const gnupgHome = env.GNUPGHOME!;
      if (!existsSync(gnupgHome)) {
        mkdirSync(gnupgHome, { recursive: true, mode: 0o700 });
      }

      const batchConfig = [
        "%echo Generating key with 1-year expiration",
        "Key-Type: RSA",
        "Key-Length: 2048",
        "Subkey-Type: RSA",
        "Subkey-Length: 2048",
        "Name-Real: pass-gui Test",
        "Name-Email: expire-test@pass-gui.local",
        "Expire-Date: 1Y",
        "%no-protection",
        "%commit",
      ].join("\n");

      run("gpg --batch --gen-key /dev/stdin", { input: batchConfig, env });

      const listOutput = run(
        "gpg --list-keys --keyid-format LONG expire-test@pass-gui.local",
        { env }
      );

      expect(listOutput).toContain("expire-test@pass-gui.local");
      expect(listOutput).toContain("pub");
      expect(listOutput).toMatch(/\[expires( |:)/);
    });
  });
});
