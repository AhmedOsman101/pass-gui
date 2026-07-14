// ---------------------------------------------------------------------------
// Integration test: Store isolation
//
// Multiple password stores with different GNUPGHOME paths — verify no
// cross-contamination between stores.
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

import { copyFileSync, existsSync, readFileSync } from "node:fs";
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

describe("Store isolation", () => {
  useEphemeralTestRoot();

  const envA = makeTestEnv(".gnupg-a", ".store-a");
  const envB = makeTestEnv(".gnupg-b", ".store-b");

  let emailA: string;
  let emailB: string;

  beforeAll(() => {
    emailA = generateKey(envA.env, { email: "test-a@pass-gui.local" });
    emailB = generateKey(envB.env, { email: "test-b@pass-gui.local" });
    initStore(envA.env, emailA);
    initStore(envB.env, emailB);
  });

  // -----------------------------------------------------------------------
  // 1. Each store is initialized with its own recipient
  // -----------------------------------------------------------------------
  describe("each store is initialized with its own recipient", () => {
    it("store A's .gpg-id contains test-a@pass-gui.local", () => {
      const gpgIdPath = join(envA.passwordStoreDir, ".gpg-id");
      expect(existsSync(gpgIdPath)).toBe(true);
      expect(readFileSync(gpgIdPath, "utf-8").trim()).toBe(emailA);
    });

    it("store B's .gpg-id contains test-b@pass-gui.local", () => {
      const gpgIdPath = join(envB.passwordStoreDir, ".gpg-id");
      expect(existsSync(gpgIdPath)).toBe(true);
      expect(readFileSync(gpgIdPath, "utf-8").trim()).toBe(emailB);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Insert into store A does not appear in store B
  // -----------------------------------------------------------------------
  describe("insert into store A does not appear in store B", () => {
    it("insert in store A, verify absent in B, present in A", () => {
      insertEntry(envA.env, "secret-a", "content-a");

      expect(treeContains(lsStore(envB.env), "secret-a")).toBe(false);
      expect(treeContains(lsStore(envA.env), "secret-a")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Store A cannot decrypt store B's entries
  // -----------------------------------------------------------------------
  describe("store A cannot decrypt store B's entries", () => {
    it("cross-store decryption fails with wrong keyring", () => {
      insertEntry(envA.env, "cross-secret", "cross-content");

      // Copy the .gpg file from store A to store B so it exists in B's store
      // directory, but B's GPG keyring (different GNUPGHOME) cannot decrypt it.
      copyFileSync(
        join(envA.passwordStoreDir, "cross-secret.gpg"),
        join(envB.passwordStoreDir, "cross-secret.gpg"),
      );

      expect(() => showEntry(envB.env, "cross-secret")).toThrow(/gpg/i);

      expect(showEntry(envA.env, "cross-secret")).toBe("cross-content");

      insertEntry(envB.env, "reverse-secret", "reverse-content");

      // Copy the .gpg file from store B to store A for the reverse direction.
      copyFileSync(
        join(envB.passwordStoreDir, "reverse-secret.gpg"),
        join(envA.passwordStoreDir, "reverse-secret.gpg"),
      );

      expect(() => showEntry(envA.env, "reverse-secret")).toThrow(/gpg/i);

      expect(showEntry(envB.env, "reverse-secret")).toBe("reverse-content");
    });
  });

  // -----------------------------------------------------------------------
  // 4. Three stores with separate keyrings
  // -----------------------------------------------------------------------
  describe("three stores with separate keyrings", () => {
    const envC = makeTestEnv(".gnupg-c", ".store-c");
    let emailC: string;

    beforeAll(() => {
      emailC = generateKey(envC.env, { email: "test-c@pass-gui.local" });
      initStore(envC.env, emailC);
    });

    it("three stores have independent content", () => {
      insertEntry(envA.env, "alpha", "a");
      insertEntry(envB.env, "beta", "b");
      insertEntry(envC.env, "gamma", "c");

      expect(treeContains(lsStore(envA.env), "alpha")).toBe(true);
      expect(treeContains(lsStore(envA.env), "beta")).toBe(false);
      expect(treeContains(lsStore(envA.env), "gamma")).toBe(false);

      expect(treeContains(lsStore(envB.env), "beta")).toBe(true);
      expect(treeContains(lsStore(envB.env), "alpha")).toBe(false);
      expect(treeContains(lsStore(envB.env), "gamma")).toBe(false);

      expect(treeContains(lsStore(envC.env), "gamma")).toBe(true);
      expect(treeContains(lsStore(envC.env), "alpha")).toBe(false);
      expect(treeContains(lsStore(envC.env), "beta")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 5. GNUPGHOME with relative vs absolute paths
  // -----------------------------------------------------------------------
  describe("GNUPGHOME with relative vs absolute paths", () => {
    it("operations work with relative GNUPGHOME path", () => {
      const suffix = "gnupg-relative";
      const storeSuffix = ".store-relative";

      // Use absolute GNUPGHOME for setup (key generation, store init)
      const absEnv = makeTestEnv(suffix, storeSuffix);

      // Use RELATIVE GNUPGHOME for pass operations to verify GPG resolves
      // relative GNUPGHOME against HOME
      const relEnv = makeTestEnv(suffix, storeSuffix, {
        GNUPGHOME: suffix,
      });

      const email = generateKey(absEnv.env, {
        email: "relative@pass-gui.local",
      });
      initStore(relEnv.env, email);

      insertEntry(relEnv.env, "relative-test", "relative-content");
      expect(showEntry(relEnv.env, "relative-test")).toBe("relative-content");
    });
  });
});
