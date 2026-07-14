// ---------------------------------------------------------------------------
// Integration test: pass git integration
//
// Tests that pass stores are git repositories by default, each operation
// creates a commit, git log shows history, git status is clean after ops,
// git diff shows content changes, and git config is persisted.
//
// Requires:
//   - gnupg 2.2+ installed
//   - pass 1.7+ installed
//   - git 2.x+ installed
//   - GNUPGHOME / PASSWORD_STORE_DIR pointing to ephemeral locations
//   - No real keyrings or password stores
//
// These tests exec real gpg, pass, and git binaries - never point them at
// your real keyring or password store.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generateKey,
  initStore,
  insertEntry,
  makeTestEnv,
  removeEntry,
  run,
  useEphemeralTestRoot,
} from "./test-utils";

function gitLog(env: NodeJS.ProcessEnv): string {
  return run(`git -C "${env.PASSWORD_STORE_DIR}" log --oneline`, { env });
}

function countGitCommits(env: NodeJS.ProcessEnv): number {
  const out = gitLog(env);
  return out === "" ? 0 : out.split("\n").length;
}

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

  it("pass init creates a git repository with an initial commit", () => {
    const log = gitLog(env);
    expect(log.length).toBeGreaterThan(0);
    expect(countGitCommits(env)).toBeGreaterThanOrEqual(1);
  });

  it("each insert operation creates a git commit", () => {
    const before = countGitCommits(env);
    const path = `git-commit-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());
    const after = countGitCommits(env);
    expect(after).toBe(before + 1);
    expect(gitLog(env)).toContain(path);
  });

  it("each remove operation creates a git commit", () => {
    const path = `git-rm-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());
    const before = countGitCommits(env);
    removeEntry(env, path);
    const after = countGitCommits(env);
    expect(after).toBe(before + 1);
    expect(gitLog(env)).toContain(path);
  });

  it("pass git log shows full operation history", () => {
    const paths = [
      `log-a-${randomUUID().slice(0, 8)}`,
      `log-b-${randomUUID().slice(0, 8)}`,
    ];
    insertEntry(env, paths[0], randomUUID());
    insertEntry(env, paths[1], randomUUID());

    const log = run("pass git log --oneline", { env });
    expect(log).toContain(paths[0]);
    expect(log).toContain(paths[1]);

    removeEntry(env, paths[0]);
    const logAfter = run("pass git log --oneline", { env });
    expect(logAfter).toContain(paths[0]);
    expect(logAfter).toContain(paths[1]);
  });

  it("git status is clean after pass operations", () => {
    const path = `status-clean-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());
    const status = run(
      `git -C "${env.PASSWORD_STORE_DIR}" status --porcelain`,
      { env }
    );
    expect(status).toBe("");
  });

  it("git diff shows content changes between commits", () => {
    const path = `diff-test-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());
    const diff = run(
      `git -C "${env.PASSWORD_STORE_DIR}" diff HEAD~1..HEAD`,
      { env }
    );
    expect(diff).toContain(path);
  });

  it("pass git config can be set and persisted", () => {
    const testName = `Test User ${randomUUID().slice(0, 4)}`;
    const testEmail =
      `gitconfig-${randomUUID().slice(0, 8)}@pass-gui.local`;

    run(
      `git -C "${env.PASSWORD_STORE_DIR}" config user.name "${testName}"`,
      { env }
    );
    run(
      `git -C "${env.PASSWORD_STORE_DIR}" config user.email "${testEmail}"`,
      { env }
    );

    const nameOut = run(
      `git -C "${env.PASSWORD_STORE_DIR}" config user.name`,
      { env }
    );
    const emailOut = run(
      `git -C "${env.PASSWORD_STORE_DIR}" config user.email`,
      { env }
    );
    expect(nameOut).toBe(testName);
    expect(emailOut).toBe(testEmail);

    const path = `config-commit-${randomUUID().slice(0, 8)}`;
    insertEntry(env, path, randomUUID());
    const author = run(
      `git -C "${env.PASSWORD_STORE_DIR}" log --format="%an <%ae>" -1`,
      { env }
    );
    expect(author).toBe(`${testName} <${testEmail}>`);
  });
});
