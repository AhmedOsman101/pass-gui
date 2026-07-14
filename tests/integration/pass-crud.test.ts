// ---------------------------------------------------------------------------
// Integration test: pass CRUD lifecycle
//
// Tests the full pass CLI lifecycle: init, insert (single/multi/subdir),
// show, ls, rm, mv, cp.
//
// Requires:
//   - gnupg 2.2+ installed
//   - pass 1.7+ installed
//   - GNUPGHOME / PASSWORD_STORE_DIR pointing to ephemeral locations
//   - No real keyrings or password stores
//
// These tests exec real gpg and pass binaries — never point them at your
// real keyring or password store.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generateKey,
  initStore,
  insertEntry,
  lsStore,
  makeTestEnv,
  removeEntry,
  run,
  showEntry,
  treeContains,
  useEphemeralTestRoot,
} from "./test-utils";

describe("Pass CRUD", () => {
  useEphemeralTestRoot();

  let env: NodeJS.ProcessEnv;
  let email: string;

  beforeAll(() => {
    const testEnv = makeTestEnv();
    env = testEnv.env;
    email = generateKey(env, { email: "pass-crud@pass-gui.local" });
    initStore(env, email);
  });

  // -----------------------------------------------------------------------
  // 1. pass init creates a password store with .gpg-id
  // -----------------------------------------------------------------------
  it("pass init creates a password store with .gpg-id", () => {
    const storeDir = env.PASSWORD_STORE_DIR!;
    expect(existsSync(storeDir)).toBe(true);

    const gpgIdPath = join(storeDir, ".gpg-id");
    expect(existsSync(gpgIdPath)).toBe(true);

    const gpgId = readFileSync(gpgIdPath, "utf-8").trim();
    expect(gpgId).toBe(email);
  });

  // -----------------------------------------------------------------------
  // 2. Insert and show a single-line entry
  // -----------------------------------------------------------------------
  it("insert and show a single-line entry", () => {
    insertEntry(env, "test-single", "my-secret-password");
    expect(showEntry(env, "test-single")).toBe("my-secret-password");
  });

  // -----------------------------------------------------------------------
  // 3. Insert with multi-line content
  // -----------------------------------------------------------------------
  it("insert with multi-line content", () => {
    run("pass insert -m test-multi", { input: "line1\nline2\nline3\n", env });
    expect(showEntry(env, "test-multi")).toBe("line1\nline2\nline3");
  });

  // -----------------------------------------------------------------------
  // 4. Insert into subdirectories
  // -----------------------------------------------------------------------
  it("insert into subdirectories", () => {
    insertEntry(env, "social/email", "email-password");
    insertEntry(env, "social/gaming/steam", "steam-password");
    expect(showEntry(env, "social/email")).toBe("email-password");
    expect(showEntry(env, "social/gaming/steam")).toBe("steam-password");
  });

  // -----------------------------------------------------------------------
  // 5. pass ls displays the store tree
  // -----------------------------------------------------------------------
  it("pass ls displays the store tree", () => {
    const tree = lsStore(env);
    expect(treeContains(tree, "test-single")).toBe(true);
    expect(treeContains(tree, "test-multi")).toBe(true);
    expect(treeContains(tree, "social")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 6. pass rm removes an entry
  // -----------------------------------------------------------------------
  it("pass rm removes an entry", () => {
    removeEntry(env, "test-single");

    const tree = lsStore(env);
    expect(treeContains(tree, "test-single")).toBe(false);

    expect(() => showEntry(env, "test-single")).toThrow();
  });

  // -----------------------------------------------------------------------
  // 7. pass mv renames/moves an entry
  // -----------------------------------------------------------------------
  it("pass mv renames/moves an entry", () => {
    run("pass mv test-multi moved-test", { env });

    expect(() => showEntry(env, "test-multi")).toThrow();

    const content = showEntry(env, "moved-test");
    expect(content).toBe("line1\nline2\nline3");
  });

  // -----------------------------------------------------------------------
  // 8. pass cp duplicates an entry
  // -----------------------------------------------------------------------
  it("pass cp duplicates an entry", () => {
    run("pass cp moved-test copied-test", { env });

    const original = showEntry(env, "moved-test");
    const copy = showEntry(env, "copied-test");
    expect(original).toBe("line1\nline2\nline3");
    expect(copy).toBe("line1\nline2\nline3");
  });

  // -----------------------------------------------------------------------
  // 9. pass ls with directory filter
  // -----------------------------------------------------------------------
  it("pass ls with directory filter", () => {
    const filteredTree = run("pass ls social", { env });
    expect(treeContains(filteredTree, "email")).toBe(true);
    expect(treeContains(filteredTree, "steam")).toBe(true);
    expect(treeContains(filteredTree, "moved-test")).toBe(false);
    expect(treeContains(filteredTree, "copied-test")).toBe(false);
  });
});
