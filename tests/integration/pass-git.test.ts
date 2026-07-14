// ---------------------------------------------------------------------------
// Integration test: pass git integration
//
// Tests that pass stores (which are git repos by default) track history
// correctly: init creates a repo, operations create commits, git log/diff
// show history, git status stays clean, and git config persists.
//
// Requires:
//   - gnupg 2.2+ installed
//   - pass 1.7+ installed
//   - GNUPGHOME / PASSWORD_STORE_DIR pointing to ephemeral locations
//   - No real keyrings or password stores
//
// These tests exec real gpg, pass, and git binaries -- never point them at
// your real keyring or password store.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generateKey,
  initStore,
  insertEntry,
  makeTestEnv,
  run,
  useEphemeralTestRoot,
} from "./test-utils";

describe("Pass git integration", () => {
  useEphemeralTestRoot();

  let env: NodeJS.ProcessEnv;
  let email: string;

  beforeAll(() => {
    const testEnv = makeTestEnv();
    env = testEnv.env;
    email = generateKey(env, { email: "pass-git@pass-gui.local" });
    initStore(env, email);
  });

  it("pass init creates a git repository", () => {
    const log = run(`git -C "${env.PASSWORD_STORE_DIR}" log --oneline`, {
      env,
    });
    expect(log).toBeTruthy();
    expect(log.split("\n").filter(Boolean).length).toBeGreaterThanOrEqual(1);
  });

  it("each pass operation creates a git commit", () => {
    const before = run(`git -C "${env.PASSWORD_STORE_DIR}" log --oneline`, {
      env,
    });
    const beforeCount = before.split("\n").filter(Boolean).length;

    const path = `git-commit-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());

    const after = run(`git -C "${env.PASSWORD_STORE_DIR}" log --oneline`, {
      env,
    });
    const afterCount = after.split("\n").filter(Boolean).length;
    expect(afterCount).toBe(beforeCount + 1);

    const lastMsg = run(
      `git -C "${env.PASSWORD_STORE_DIR}" log -1 --pretty=format:"%s"`,
      { env }
    );
    expect(lastMsg).toContain(path);
  });

  it("pass git log shows operation history", () => {
    const paths = [
      `git-log-a-${randomUUID().slice(0, 8)}`,
      `git-log-b-${randomUUID().slice(0, 8)}`,
      `git-log-c-${randomUUID().slice(0, 8)}`,
    ];
    for (const p of paths) {
      insertEntry(env, p, randomUUID());
    }

    const gitLog = run("pass git log --oneline", { env });
    for (const p of paths) {
      expect(gitLog).toContain(p);
    }
  });

  it("pass git status is clean after operations", () => {
    const path = `git-status-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());

    const status = run(
      `git -C "${env.PASSWORD_STORE_DIR}" status --porcelain`,
      { env }
    );
    expect(status).toBe("");
  });

  it("git diff shows content changes", () => {
    const path = `git-diff-${randomUUID().slice(0, 8)}`;
    const password = randomUUID();
    insertEntry(env, path, password);

    const diff = run("pass git diff HEAD~1..HEAD", { env });
    expect(diff).toContain(password);
  });

  it("pass git config can be set and persists", () => {
    const name = "Test User";
    const gitEmail = "test-user@pass-gui.local";

    run(`pass git config user.name "${name}"`, { env });
    run(`pass git config user.email "${gitEmail}"`, { env });

    const readName = run("pass git config user.name", { env });
    const readEmail = run("pass git config user.email", { env });
    expect(readName).toBe(name);
    expect(readEmail).toBe(gitEmail);

    const path = `git-config-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());

    const author = run(
      `git -C "${env.PASSWORD_STORE_DIR}" log -1 --format="%an <%ae>"`,
      { env }
    );
    expect(author).toBe(`${name} <${gitEmail}>`);
  });
});
