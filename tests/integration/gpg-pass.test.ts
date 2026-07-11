// ---------------------------------------------------------------------------
// Integration test: GPG key generation + pass store operations
//
// Requires:
//   - gnupg, pass, git installed
//   - GNUPGHOME and PASSWORD_STORE_DIR point to writable, ephemeral locations
//
// Run inside the Podman container (Containerfile.test):
//   pnpm --filter=client vitest run tests/integration/
//
// Or manually (after installing system tools):
//   GNUPGHOME=/tmp/pg-test-gpg PASSWORD_STORE_DIR=/tmp/pg-test-store \
//     pnpm --filter=client vitest run tests/integration/
//
// These tests exec actual gpg/pass binaries — never point them at your real
// password store or GPG keyring.
// ---------------------------------------------------------------------------

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const TEST_ID = `pass-gui-int-${Date.now()}`;
const testRoot = join(tmpdir(), TEST_ID);

const GNUPGHOME = join(testRoot, ".gnupg");
const PASSWORD_STORE_DIR = join(testRoot, ".password-store");

type RunOptions = {
  input?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

function run(command: string, opts?: RunOptions): string {
  const result: string = execSync(command, {
    encoding: "utf-8",
    env: {
      GNUPGHOME,
      PASSWORD_STORE_DIR,
      HOME: testRoot,
      PATH: process.env.PATH,
      ...opts?.env,
    },
    cwd: opts?.cwd ?? testRoot,
    input: opts?.input,
    stdio: opts?.input ? ["pipe", "pipe", "pipe"] : undefined,
  });
  return result.trim();
}

beforeAll(() => {
  // Clean any previous run
  rmSync(testRoot, { recursive: true, force: true });

  // GPG needs a secure home directory
  mkdirSync(GNUPGHOME, { recursive: true, mode: 0o700 });

  // Verify required binaries exist
  for (const bin of ["gpg", "pass", "git"]) {
    try {
      execSync(`which ${bin}`, { stdio: "pipe" });
    } catch {
      throw new Error(
        `${bin} is not installed. Run inside the Podman container or install it locally.`
      );
    }
  }
});

describe("GPG key generation", () => {
  it("generates a non-expiring key from batch config", () => {
    const batchConfig = [
      "%echo Generating test key",
      "Key-Type: RSA",
      "Key-Length: 2048",
      "Subkey-Type: RSA",
      "Subkey-Length: 2048",
      "Name-Real: pass-gui Test",
      "Name-Email: test@pass-gui.local",
      "Expire-Date: 0",
      "%no-protection",
      "%commit",
    ].join("\n");

    run("gpg --batch --gen-key /dev/stdin", { input: batchConfig });

    // Verify the key exists in the keyring
    const listOutput = run("gpg --list-keys --keyid-format LONG");

    expect(listOutput).toContain("test@pass-gui.local");
    expect(listOutput).toContain("pub");
  });
});

describe("pass store initialization", () => {
  it("init creates a password store with .gpg-id", () => {
    run("pass init test@pass-gui.local");

    expect(existsSync(PASSWORD_STORE_DIR)).toBe(true);
    expect(existsSync(join(PASSWORD_STORE_DIR, ".gpg-id"))).toBe(true);
  });

  it(".gpg-id contains the recipient email", () => {
    const gpgId = run(`cat ${join(PASSWORD_STORE_DIR, ".gpg-id")}`);
    expect(gpgId).toBe("test@pass-gui.local");
  });
});

describe("pass insert and show", () => {
  it("inserts and shows a password entry", () => {
    run('echo "my-secret" | pass insert -e test/entry1');

    const output = run("pass show test/entry1");
    expect(output).toBe("my-secret");
  });

  it("inserts multi-level paths", () => {
    run('echo "email-pass" | pass insert -e social/email');
    run('echo "game-pass" | pass insert -e social/gaming/steam');

    const email = run("pass show social/email");
    const steam = run("pass show social/gaming/steam");

    expect(email).toBe("email-pass");
    expect(steam).toBe("game-pass");
  });
});

describe("pass ls", () => {
  it("lists the store tree", () => {
    const tree = run("pass ls");

    expect(tree).toContain("test");
    expect(tree).toContain("social");
  });
});

describe("pass rm", () => {
  it("removes an entry", () => {
    run("pass rm -f test/entry1");

    // Verify it's gone
    const list = run("pass ls");
    expect(list).not.toContain("entry1");
  });
});

describe("Multiple GNUPGHOME overrides", () => {
  it("uses a different GPG home when specified", () => {
    const altGnupgHome = join(testRoot, ".gnupg-alt");
    mkdirSync(altGnupgHome, { recursive: true, mode: 0o700 });

    const batchConfig = [
      "Key-Type: RSA",
      "Key-Length: 2048",
      "Name-Real: pass-gui Alt",
      "Name-Email: alt-test@pass-gui.local",
      "Expire-Date: 0",
      "%no-protection",
      "%commit",
    ].join("\n");

    run("gpg --batch --gen-key /dev/stdin", {
      input: batchConfig,
      env: {
        GNUPGHOME: altGnupgHome,
        HOME: testRoot,
        PATH: process.env.PATH ?? "/usr/bin",
      },
    });

    const altPasswordStoreDir = join(testRoot, ".password-store-alt");
    run("pass init alt-test@pass-gui.local", {
      env: {
        GNUPGHOME: altGnupgHome,
        PASSWORD_STORE_DIR: altPasswordStoreDir,
        HOME: testRoot,
        PATH: process.env.PATH ?? "/usr/bin",
      },
    });

    expect(existsSync(altPasswordStoreDir)).toBe(true);
    expect(existsSync(join(altPasswordStoreDir, ".gpg-id"))).toBe(true);

    // Second store should be isolated from the first
    const firstList = run("pass ls");
    const firstGpgId = run(`cat ${join(PASSWORD_STORE_DIR, ".gpg-id")}`);

    expect(firstGpgId).toBe("test@pass-gui.local");
    expect(firstList).not.toContain("alt-test");
  });
});

describe("pass git integration", () => {
  it("creates a git repo in the store", () => {
    const gitLog = run(`git -C "${PASSWORD_STORE_DIR}" log --oneline`);
    expect(gitLog).toBeTruthy();
    expect(gitLog.split("\n").length).toBeGreaterThanOrEqual(1);
  });
});
