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

import { randomUUID } from "node:crypto";
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

  it("pass init creates a password store with .gpg-id", () => {
    const storeDir = env.PASSWORD_STORE_DIR!;
    expect(existsSync(storeDir)).toBe(true);

    const gpgIdPath = join(storeDir, ".gpg-id");
    expect(existsSync(gpgIdPath)).toBe(true);

    const gpgId = readFileSync(gpgIdPath, "utf-8").trim();
    expect(gpgId).toBe(email);
  });

  it("insert and show a single-line entry", () => {
    const password = randomUUID();
    insertEntry(env, "test-single", password);
    expect(showEntry(env, "test-single")).toBe(password);
  });

  it("insert with multi-line content", () => {
    const lines = [randomUUID(), randomUUID(), randomUUID()];
    const content = lines.join("\n");
    run("pass insert -m test-multi", { input: `${content}\n`, env });
    expect(showEntry(env, "test-multi")).toBe(content);
  });

  it("insert into subdirectories", () => {
    const emailPw = randomUUID();
    const steamPw = randomUUID();
    insertEntry(env, "social/email", emailPw);
    insertEntry(env, "social/gaming/steam", steamPw);
    expect(showEntry(env, "social/email")).toBe(emailPw);
    expect(showEntry(env, "social/gaming/steam")).toBe(steamPw);
  });

  it("pass ls displays the store tree", () => {
    insertEntry(env, "ls-test-alpha", randomUUID());
    insertEntry(env, "ls-test-beta", randomUUID());
    insertEntry(env, "ls-test-sub/gamma", randomUUID());

    const tree = lsStore(env);
    expect(treeContains(tree, "ls-test-alpha")).toBe(true);
    expect(treeContains(tree, "ls-test-beta")).toBe(true);
    expect(treeContains(tree, "ls-test-sub")).toBe(true);
  });

  it("pass rm removes an entry", () => {
    const password = randomUUID();
    insertEntry(env, "rm-test", password);
    expect(showEntry(env, "rm-test")).toBe(password);

    removeEntry(env, "rm-test");

    const tree = lsStore(env);
    expect(treeContains(tree, "rm-test")).toBe(false);

    expect(() => showEntry(env, "rm-test")).toThrow(/password store/i);
  });

  it("pass mv renames/moves an entry", () => {
    const lines = [randomUUID(), randomUUID()];
    const content = lines.join("\n");
    run("pass insert -m mv-origin", { input: `${content}\n`, env });
    expect(showEntry(env, "mv-origin")).toBe(content);

    run("pass mv mv-origin mv-dest", { env });

    expect(() => showEntry(env, "mv-origin")).toThrow(/password store/i);

    expect(showEntry(env, "mv-dest")).toBe(content);
  });

  it("pass cp duplicates an entry", () => {
    const lines = [randomUUID(), randomUUID()];
    const content = lines.join("\n");
    run("pass insert -m cp-origin", { input: `${content}\n`, env });
    expect(showEntry(env, "cp-origin")).toBe(content);

    run("pass cp cp-origin cp-copy", { env });

    expect(showEntry(env, "cp-origin")).toBe(content);
    expect(showEntry(env, "cp-copy")).toBe(content);
  });

  it("pass ls with directory filter", () => {
    insertEntry(env, "filter-a/entry1", randomUUID());
    insertEntry(env, "filter-a/entry2", randomUUID());
    insertEntry(env, "filter-b/entry3", randomUUID());

    const filteredTree = run("pass ls filter-a", { env });
    expect(treeContains(filteredTree, "entry1")).toBe(true);
    expect(treeContains(filteredTree, "entry2")).toBe(true);
    expect(treeContains(filteredTree, "entry3")).toBe(false);
    expect(treeContains(filteredTree, "filter-b")).toBe(false);
  });
});
