// ---------------------------------------------------------------------------
// Shared utilities for integration tests.
//
// Every test suite works inside an ephemeral test root so suites never collide.
// The test root is cleaned before each run and deleted after all suites finish.
//
// Each suite declares its own env (GNUPGHOME, PASSWORD_STORE_DIR) via
// `makeTestEnv()` so parallel vitest workers are isolated.
//
// All functions exec real gpg/pass/git binaries — never point them at real
// keyrings or password stores.
// ---------------------------------------------------------------------------

import { type ExecSyncOptions, execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll } from "vitest";

// ---------------------------------------------------------------------------
// One shared test root per test process.  OK for serial execution; parallel
// workers would need per-worker roots (vitest pool: "forks" gives us that).
// ---------------------------------------------------------------------------
const TEST_ID = `pass-gui-int-${process.env.VITEST_WORKER_ID ?? "0"}-${Date.now()}`;
const testRoot = join(tmpdir(), TEST_ID);

/** Clean the test root.  Safe to call multiple times. */
function cleanTestRoot(): void {
  rmSync(testRoot, { recursive: true, force: true });
}

/** Create the top-level test directory with proper permissions. */
function createTestRoot(): void {
  cleanTestRoot();
  mkdirSync(testRoot, { recursive: true });
}

/**
 * Verify that every binary in the list is available on $PATH.
 * Throws with a helpful message if any is missing.
 */
function requireBinaries(...bins: string[]): void {
  for (const bin of bins) {
    try {
      execSync(`which "${bin}"`, { stdio: "pipe" });
    } catch {
      throw new Error(
        `${bin} is not installed.  Run inside the Podman container ` +
          "(Containerfile.test) or install it locally:\n" +
          "  podman build -t pass-gui-test -f Containerfile.test .\n" +
          "  podman run --rm -v $(pwd):/app -w /app pass-gui-test ..."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Env builder
// ---------------------------------------------------------------------------

type EnvOverrides = Record<string, string>;

/**
 * Build a complete environment for a test suite.
 *
 * @param gnupghomeSuffix - appended to testRoot for GNUPGHOME (e.g. ".gnupg")
 * @param storeSuffix     - appended to testRoot for PASSWORD_STORE_DIR
 * @param overrides       - additional env vars (merged on top)
 */
function makeTestEnv(
  gnupghomeSuffix = ".gnupg",
  storeSuffix = ".password-store",
  overrides: EnvOverrides = {}
): {
  gnupgHome: string;
  passwordStoreDir: string;
  env: NodeJS.ProcessEnv;
} {
  const gnupgHome = join(testRoot, gnupghomeSuffix);
  const passwordStoreDir = join(testRoot, storeSuffix);

  return {
    gnupgHome,
    passwordStoreDir,
    env: {
      GNUPGHOME: gnupgHome,
      PASSWORD_STORE_DIR: passwordStoreDir,
      HOME: testRoot,
      PATH: process.env.PATH ?? "/usr/bin",
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// GPG key generation
// ---------------------------------------------------------------------------

type GpgKeyParams = {
  realName?: string;
  email: string;
  keyType?: string;
  keyLength?: number;
};

function generateKey(env: NodeJS.ProcessEnv, params: GpgKeyParams): string {
  const gnupgHome = env.GNUPGHOME;
  if (!gnupgHome) throw new Error("GNUPGHOME not set in env");
  if (!existsSync(gnupgHome)) {
    mkdirSync(gnupgHome, { recursive: true, mode: 0o700 });
  }

  const batchConfig = [
    "%echo Generating test key",
    `Key-Type: ${params.keyType ?? "RSA"}`,
    `Key-Length: ${String(params.keyLength ?? "2048")}`,
    "Subkey-Type: RSA",
    "Subkey-Length: 2048",
    `Name-Real: ${params.realName ?? "pass-gui Test"}`,
    `Name-Email: ${params.email}`,
    "Expire-Date: 0",
    "%no-protection",
    "%commit",
  ].join("\n");

  run("gpg --batch --gen-key /dev/stdin", { input: batchConfig, env });
  return params.email;
}

/** Get the key ID / fingerprint for a given email. */
function getKeyId(env: NodeJS.ProcessEnv, email: string): string {
  const out = run(`gpg --list-secret-keys --keyid-format LONG "${email}"`, {
    env,
  });
  // "sec:u:2048:1:AAAAAAAAAAAAAAAA:..." -> key ID (field 5)
  const colonOut = run(
    `gpg --list-secret-keys --with-colons --fixed-list-mode "${email}"`,
    { env }
  );
  const secLine = colonOut.split("\n").find(l => l.startsWith("sec:"));
  if (!secLine) throw new Error(`Could not find secret key for ${email}`);
  const fields = secLine.split(":");
  return fields[4] ?? ""; // field 5 = key ID
}

/** Get the full fingerprint for a given email. */
function getFingerprint(env: NodeJS.ProcessEnv, email: string): string {
  const colonOut = run(
    `gpg --list-secret-keys --with-colons --fixed-list-mode "${email}"`,
    { env }
  );
  const lines = colonOut.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith("sec:")) {
      // fingerprint is in the next "fpr:" record
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (!l) continue;
        if (l.startsWith("fpr:")) return l.split(":")[9] ?? "";
        if (l.startsWith("ssb:") || l.startsWith("sec:")) break;
      }
    }
  }
  throw new Error(`Could not find fingerprint for ${email}`);
}

// ---------------------------------------------------------------------------
// Pass store management
// ---------------------------------------------------------------------------

/** Initialise a password store with the given recipient(s). */
function initStore(env: NodeJS.ProcessEnv, ...recipients: string[]): void {
  const storeDir = env.PASSWORD_STORE_DIR;
  if (!storeDir) throw new Error("PASSWORD_STORE_DIR not set in env");
  if (!existsSync(storeDir)) {
    mkdirSync(storeDir, { recursive: true });
  }
  for (const recipient of recipients) {
    run(`pass init "${recipient}"`, { env });
  }
}

/** Insert a password entry.  Uses `-e` (echo) for simple values. */
function insertEntry(
  env: NodeJS.ProcessEnv,
  path: string,
  content: string
): void {
  run(`echo "${content}" | pass insert -e "${path}"`, { env });
}

/** Show a password entry's content. */
function showEntry(env: NodeJS.ProcessEnv, path: string): string {
  return run(`pass show "${path}"`, { env });
}

/** Remove a password entry. */
function removeEntry(env: NodeJS.ProcessEnv, path: string): void {
  run(`pass rm -f "${path}"`, { env });
}

/** List the store tree. */
function lsStore(env: NodeJS.ProcessEnv): string {
  return run("pass ls", { env });
}

// ---------------------------------------------------------------------------
// Low-level command runner
// ---------------------------------------------------------------------------

type RunOptions = {
  input?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

/**
 * Execute a shell command and return trimmed stdout.
 * Throws on non-zero exit.
 */
function run(command: string, opts?: RunOptions): string {
  const execOpts: ExecSyncOptions = {
    encoding: "utf-8" as const,
    env: { ...process.env, ...opts?.env },
    cwd: opts?.cwd ?? testRoot,
    stdio: opts?.input ? ["pipe", "pipe", "pipe"] : undefined,
  };

  const result = execSync(command, execOpts);
  return (result as string).trim();
}

// ---------------------------------------------------------------------------
// Custom matchers for GPG/pass output
// ---------------------------------------------------------------------------

/**
 * Check if a pass `ls` tree output contains a specific entry path.
 *
 * pass ls outputs a tree like:
 *   ├── test
 *   │   ├── credentials
 *   │   │   ├── email
 *   │   │   └── gaming
 *   │   └── example
 */
function treeContains(treeOutput: string, entry: string): boolean {
  return treeOutput.includes(entry);
}

// ---------------------------------------------------------------------------
// Global setup / teardown (register with vitest — suites that call this
// don't need to manage the root themselves).
// ---------------------------------------------------------------------------

/** Call in a describe block's `beforeAll` / `afterAll` to get an ephemeral
 * test root that is cleaned up automatically. */
function useEphemeralTestRoot(): void {
  beforeAll(() => {
    requireBinaries("gpg", "pass", "git");
    createTestRoot();
  });

  afterAll(() => {
    cleanTestRoot();
  });
}

export {
  cleanTestRoot,
  createTestRoot,
  type EnvOverrides,
  type GpgKeyParams,
  // GPG helpers
  generateKey,
  getFingerprint,
  getKeyId,
  // Pass helpers
  initStore,
  insertEntry,
  lsStore,
  // Env builder
  makeTestEnv,
  removeEntry,
  // Binary check
  requireBinaries,
  // Command runner
  run,
  showEntry,
  // Root management
  testRoot,
  // Assertion helpers
  treeContains,
  useEphemeralTestRoot,
};
