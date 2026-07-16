// ---------------------------------------------------------------------------
// Integration test: Store validation
//
// Validates real store state detection: initialized, uninitialized,
// missing .gpg-id, empty store, multi-recipient, and comment handling.
//
// Requires:
//   - gnupg 2.2+ installed
//   - pass 1.7+ installed
//   - GNUPGHOME / PASSWORD_STORE_DIR pointing to ephemeral locations
//   - No real keyrings or password stores
//
// Run inside the Podman container (Containerfile.test):
//   pnpm test:integration
//
// These tests exec real gpg and pass binaries — never point them at your
// real keyring or password store.
// ---------------------------------------------------------------------------

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generateKey,
  initStore,
  insertEntry,
  lsStore,
  makeTestEnv,
  showEntry,
  treeContains,
  useEphemeralTestRoot,
} from "./test-utils";

describe("Store validation", () => {
  useEphemeralTestRoot();

  // -----------------------------------------------------------------------
  // 1. Properly initialized store is detected
  // -----------------------------------------------------------------------
  describe("properly initialized store is detected", () => {
    const envData = makeTestEnv(".gnupg-init", ".store-init");
    let email: string;

    beforeAll(() => {
      email = generateKey(envData.env, {
        email: "init@pass-gui.local",
      });
      initStore(envData.env, email);
    });

    it(".gpg-id exists and contains the recipient", () => {
      const gpgIdPath = join(envData.passwordStoreDir, ".gpg-id");
      expect(existsSync(gpgIdPath)).toBe(true);
      expect(readFileSync(gpgIdPath, "utf-8").trim()).toBe(email);
    });

    it(".gpg-id content matches expected format (one recipient per line)", () => {
      const gpgIdPath = join(envData.passwordStoreDir, ".gpg-id");
      const content = readFileSync(gpgIdPath, "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(1);
      expect(lines[0]?.trim()).toBe(email);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Uninitialized directory is detected
  // -----------------------------------------------------------------------
  describe("uninitialized directory is detected", () => {
    const envData = makeTestEnv(".gnupg-uninit", ".store-uninit");

    beforeAll(() => {
      mkdirSync(envData.passwordStoreDir, { recursive: true });
    });

    it(".gpg-id does NOT exist", () => {
      const gpgIdPath = join(envData.passwordStoreDir, ".gpg-id");
      expect(existsSync(gpgIdPath)).toBe(false);
    });

    it("directory exists but is not a pass store", () => {
      expect(existsSync(envData.passwordStoreDir)).toBe(true);
      expect(() => lsStore(envData.env)).toThrow(/must run/i);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Missing .gpg-id after deleting it
  // -----------------------------------------------------------------------
  describe("missing .gpg-id after deleting it", () => {
    const envData = makeTestEnv(".gnupg-del", ".store-del");

    beforeAll(() => {
      const email = generateKey(envData.env, {
        email: "del@pass-gui.local",
      });
      initStore(envData.env, email);
    });

    it("directory exists but .gpg-id is removed", () => {
      const gpgIdPath = join(envData.passwordStoreDir, ".gpg-id");
      expect(existsSync(gpgIdPath)).toBe(true);

      rmSync(gpgIdPath);

      expect(existsSync(gpgIdPath)).toBe(false);
      expect(existsSync(envData.passwordStoreDir)).toBe(true);
    });

    it("pass commands fail after .gpg-id deletion", () => {
      expect(() => lsStore(envData.env)).toThrow(/must run/i);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Store with multiple recipients
  // -----------------------------------------------------------------------
  describe("store with multiple recipients", () => {
    const envData = makeTestEnv(".gnupg-multi", ".store-multi");
    let email1: string;
    let email2: string;

    beforeAll(() => {
      email1 = generateKey(envData.env, {
        email: "multi-a@pass-gui.local",
      });
      email2 = generateKey(envData.env, {
        realName: "pass-gui Test B",
        email: "multi-b@pass-gui.local",
      });
      initStore(envData.env, email1, email2);
    });

    it(".gpg-id contains both email addresses", () => {
      const gpgIdPath = join(envData.passwordStoreDir, ".gpg-id");
      const content = readFileSync(gpgIdPath, "utf-8");
      expect(content).toContain(email1);
      expect(content).toContain(email2);

      const lines = content
        .trim()
        .split("\n")
        .filter(l => l.trim());
      expect(lines).toHaveLength(2);
    });

    it("both keys can decrypt entries", () => {
      insertEntry(envData.env, "multi-secret", "shared-password");

      const decrypted = showEntry(envData.env, "multi-secret");
      expect(decrypted).toBe("shared-password");
    });
  });

  // -----------------------------------------------------------------------
  // 5. Empty store detection
  // -----------------------------------------------------------------------
  describe("empty store detection", () => {
    const envData = makeTestEnv(".gnupg-empty", ".store-empty");

    beforeAll(() => {
      const email = generateKey(envData.env, {
        email: "empty@pass-gui.local",
      });
      initStore(envData.env, email);
    });

    it("no .gpg files exist in the store directory", () => {
      const storeDir = envData.passwordStoreDir;
      const entries = readdirSync(storeDir);
      const gpgFiles = entries.filter(e => e.endsWith(".gpg"));
      expect(gpgFiles).toHaveLength(0);
    });

    it("only .gpg-id and .git directory exist (plus dotfiles)", () => {
      const storeDir = envData.passwordStoreDir;
      const entries = readdirSync(storeDir).filter(
        e => e !== ".git" && e !== ".gpg-id"
      );
      expect(entries).toHaveLength(0);
    });

    it("pass ls returns empty tree", () => {
      const tree = lsStore(envData.env);
      expect(tree).toContain("Password Store");
      expect(treeContains(tree, ".gpg")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Store with entries is detected as non-empty
  // -----------------------------------------------------------------------
  describe("store with entries is detected as non-empty", () => {
    const envData = makeTestEnv(".gnupg-nonempty", ".store-nonempty");

    beforeAll(() => {
      const email = generateKey(envData.env, {
        email: "nonempty@pass-gui.local",
      });
      initStore(envData.env, email);
    });

    it(".gpg file exists in the store", () => {
      insertEntry(envData.env, "some-entry", "some-password");

      const storeDir = envData.passwordStoreDir;
      const entries = readdirSync(storeDir);
      const gpgFiles = entries.filter(e => e.endsWith(".gpg"));
      expect(gpgFiles.length).toBeGreaterThanOrEqual(1);
    });

    it("store contains password entries", () => {
      const tree = lsStore(envData.env);
      expect(treeContains(tree, "some-entry")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Store with comments in .gpg-id
  // -----------------------------------------------------------------------
  describe("store with comments in .gpg-id", () => {
    const envData = makeTestEnv(".gnupg-comment", ".store-comment");

    beforeAll(() => {
      const email = generateKey(envData.env, {
        email: "comment@pass-gui.local",
      });
      initStore(envData.env, email);
    });

    it("pass correctly parses the key ID (strips comment)", () => {
      const gpgIdPath = join(envData.passwordStoreDir, ".gpg-id");
      const email = "comment@pass-gui.local";

      writeFileSync(gpgIdPath, `${email} # this is a comment\n`, "utf-8");

      insertEntry(envData.env, "commented-entry", "commented-password");

      const decrypted = showEntry(envData.env, "commented-entry");
      expect(decrypted).toBe("commented-password");
    });

    it("entries inserted after comment-bearing .gpg-id can be decrypted", () => {
      insertEntry(envData.env, "another-commented", "another-password");

      const decrypted = showEntry(envData.env, "another-commented");
      expect(decrypted).toBe("another-password");
    });
  });
});
