// ---------------------------------------------------------------------------
// Integration test: pass generate
//
// Tests password generation via pass generate: creates entries, respects
// requested length, --no-symbols / -n flag, and --force overwrite.
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
import { beforeAll, describe, expect, it } from "vitest";
import {
  generateKey,
  initStore,
  insertEntry,
  lsStore,
  makeTestEnv,
  run,
  showEntry,
  treeContains,
  useEphemeralTestRoot,
} from "./test-utils";

describe("Pass generate", () => {
  useEphemeralTestRoot();

  let env: NodeJS.ProcessEnv;
  let email: string;

  beforeAll(() => {
    const testEnv = makeTestEnv();
    env = testEnv.env;
    email = generateKey(env, { email: "pass-generate@pass-gui.local" });
    initStore(env, email);
  });

  it("creates an entry with random password", () => {
    const path = `gen-create-${randomUUID().slice(0, 8)}`;
    const length = 20;
    const output = run(`pass generate "${path}" ${length}`, { env });

    expect(output.length).toBe(length);
    expect(treeContains(lsStore(env), path)).toBe(true);

    const stored = showEntry(env, path);
    expect(stored.length).toBeGreaterThan(0);
  });

  it("generated password has the requested length", () => {
    const path20 = `gen-len-20-${randomUUID().slice(0, 8)}`;
    run(`pass generate "${path20}" 20`, { env });
    expect(showEntry(env, path20).length).toBe(20);

    const path8 = `gen-len-8-${randomUUID().slice(0, 8)}`;
    run(`pass generate "${path8}" 8`, { env });
    expect(showEntry(env, path8).length).toBe(8);
  });

  it("--no-symbols excludes special characters", () => {
    const path = `gen-nosym-${randomUUID().slice(0, 8)}`;
    const output = run(`pass generate --no-symbols "${path}" 30`, { env });
    expect(output).toMatch(/^[a-zA-Z0-9]+$/);

    const pathSym = `gen-sym-${randomUUID().slice(0, 8)}`;
    const outputSym = run(`pass generate "${pathSym}" 30`, { env });
    expect(outputSym).toMatch(/[^a-zA-Z0-9]/);
  });

  it("-n (--no-symbols) with different lengths", () => {
    const path4 = `gen-n4-${randomUUID().slice(0, 8)}`;
    run(`pass generate -n "${path4}" 4`, { env });
    expect(showEntry(env, path4).length).toBe(4);

    const path64 = `gen-n64-${randomUUID().slice(0, 8)}`;
    run(`pass generate -n "${path64}" 64`, { env });
    expect(showEntry(env, path64).length).toBe(64);
  });

  it("generate with existing entry and --force", () => {
    const path = `gen-force-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, "initial-password");
    expect(showEntry(env, path)).toBe("initial-password");

    expect(() => run(`pass generate "${path}" 20`, { env })).toThrow(
      /already exists/i
    );

    const output = run(`pass generate -f "${path}" 20`, { env });
    expect(output.length).toBe(20);

    const stored = showEntry(env, path);
    expect(stored.length).toBe(20);
  });
});
