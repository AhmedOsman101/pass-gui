// ---------------------------------------------------------------------------
// Integration test: error paths
//
// Tests that pass and GPG fail gracefully and predictably when given bad
// inputs: missing stores, non-existent keys, invalid paths, corrupt metadata,
// and cross-key decryption failures.
//
// Requires:
//   - gnupg 2.2+ installed
//   - pass 1.7+ installed
//   - GNUPGHOME / PASSWORD_STORE_DIR pointing to ephemeral locations
//   - No real keyrings or password stores
//
// These tests exec real gpg and pass binaries -- never point them at your
// real keyring or password store.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generateKey,
  initStore,
  insertEntry,
  makeTestEnv,
  run,
  useEphemeralTestRoot,
} from "./test-utils";

describe("Error paths", () => {
  useEphemeralTestRoot();

  let env: NodeJS.ProcessEnv;
  let email: string;

  beforeAll(() => {
    const testEnv = makeTestEnv();
    env = testEnv.env;
    email = generateKey(env, { email: "error-paths@pass-gui.local" });
    initStore(env, email);
  });

  // -----------------------------------------------------------------------
  // 1. pass command with missing store fails gracefully
  // -----------------------------------------------------------------------
  it("pass ls with non-existent store fails with meaningful error", () => {
    const badStoreEnv = {
      ...env,
      PASSWORD_STORE_DIR: "/nonexistent/path/to/store",
    };

    expect(() => run("pass ls", { env: badStoreEnv })).toThrow();
    try {
      run("pass ls", { env: badStoreEnv });
    } catch (err: unknown) {
      const msg = String((err as Error).message).toLowerCase();
      expect(
        msg.includes("password-store") ||
          msg.includes("store") ||
          msg.includes("directory") ||
          msg.includes("init") ||
          msg.includes("error")
      ).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // 2. pass init with non-existent GPG key fails
  // -----------------------------------------------------------------------
  it("pass init with non-existent GPG key fails", () => {
    const freshDir = join(
      env.GNUPGHOME!,
      `../init-fail-${randomUUID().slice(0, 8)}`
    );
    mkdirSync(freshDir, { recursive: true });
    const failEnv = {
      ...env,
      PASSWORD_STORE_DIR: freshDir,
    };

    expect(() => run("pass init nonexistent@key", { env: failEnv })).toThrow();
  });

  // -----------------------------------------------------------------------
  // 3. pass show for non-existent entry fails
  // -----------------------------------------------------------------------
  it("pass show for non-existent entry fails", () => {
    const badPath = `nonexistent-${randomUUID().slice(0, 8)}`;
    expect(() => run(`pass show "${badPath}"`, { env })).toThrow();
    try {
      run(`pass show "${badPath}"`, { env });
    } catch (err: unknown) {
      const msg = String((err as Error).message).toLowerCase();
      expect(
        msg.includes("is not in the password store") ||
          msg.includes("not found") ||
          msg.includes("error")
      ).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // 4. pass insert with path traversal fails
  // -----------------------------------------------------------------------
  it("pass insert rejects path with directory traversal", () => {
    expect(() =>
      run(`echo "secret" | pass insert -e "../escape-path"`, { env })
    ).toThrow();
  });

  // -----------------------------------------------------------------------
  // 5. GPG encryption with non-existent recipient fails
  // -----------------------------------------------------------------------
  it("gpg --encrypt with non-existent recipient fails", () => {
    const tmpFile = join(env.GNUPGHOME!, "plain.txt");
    writeFileSync(tmpFile, "test data", "utf-8");

    const outFile = join(env.GNUPGHOME!, "enc.txt");

    expect(() =>
      run(
        `gpg --batch --yes --trust-model always --encrypt --recipient "nobody@example.com" --output "${outFile}" "${tmpFile}"`,
        { env }
      )
    ).toThrow();
  });

  // -----------------------------------------------------------------------
  // 6. pass rm of non-existent entry fails
  // -----------------------------------------------------------------------
  it("pass rm -f of non-existent entry fails", () => {
    const badPath = `rm-missing-${randomUUID().slice(0, 8)}`;
    expect(() => run(`pass rm -f "${badPath}"`, { env })).toThrow();
    try {
      run(`pass rm -f "${badPath}"`, { env });
    } catch (err: unknown) {
      const msg = String((err as Error).message).toLowerCase();
      expect(
        msg.includes("is not in the password store") ||
          msg.includes("not found") ||
          msg.includes("error")
      ).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // 7. Corrupt store: empty .gpg-id causes operations to fail
  // -----------------------------------------------------------------------
  it("operations fail with empty .gpg-id", () => {
    const corruptStoreDir = join(
      env.GNUPGHOME!,
      `../corrupt-store-${randomUUID().slice(0, 8)}`
    );
    mkdirSync(corruptStoreDir, { recursive: true });
    writeFileSync(join(corruptStoreDir, ".gpg-id"), "", "utf-8");

    const corruptEnv = {
      ...env,
      PASSWORD_STORE_DIR: corruptStoreDir,
    };

    expect(() => run("pass ls", { env: corruptEnv })).toThrow();
  });

  // -----------------------------------------------------------------------
  // 8. GPG decryption with wrong key fails
  // -----------------------------------------------------------------------
  it("decryption fails when secret key is missing", () => {
    // Key A: used for encryption
    const gnupgHomeA = join(env.GNUPGHOME!, `../keyA-${randomUUID().slice(0, 8)}`);
    const envA = { ...env, GNUPGHOME: gnupgHomeA };
    const emailA = generateKey(envA, {
      email: `keyA-${randomUUID().slice(0, 8)}@test.local`,
      realName: "Key A",
    });

    // Key B: different keyring for decryption attempt
    const gnupgHomeB = join(env.GNUPGHOME!, `../keyB-${randomUUID().slice(0, 8)}`);
    const envB = { ...env, GNUPGHOME: gnupgHomeB };
    generateKey(envB, {
      email: `keyB-${randomUUID().slice(0, 8)}@test.local`,
      realName: "Key B",
    });

    // Encrypt a file with key A
    const plainFile = join(gnupgHomeA, "plain.txt");
    const encFile = join(gnupgHomeA, "enc.txt");
    writeFileSync(plainFile, "sensitive data", "utf-8");
    run(
      `gpg --batch --yes --trust-model always --encrypt --recipient "${emailA}" --output "${encFile}" "${plainFile}"`,
      { env: envA }
    );

    // Attempt to decrypt with key B's keyring -- should fail (no secret key)
    expect(() =>
      run(`gpg --batch --decrypt --output /dev/null "${encFile}"`, {
        env: envB,
      })
    ).toThrow();
  });
});
