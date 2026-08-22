import type { ExecCommandResult } from "@neutralinojs/lib";
import { Err, Ok, type Result } from "lib-result";
import { CommandFailedError } from "@/lib/errors";
import { generateMemorablePassword } from "@/lib/generate-password";
import { parsePassShowOutput } from "@/lib/parse-pass-show";
import { walkStore } from "@/lib/store-walker";
import type {
  EntryDetail,
  EntryTree,
  MutationInput,
  MutationResult,
} from "@/types/entries";
import { Pass } from "./pass";

/** Why an entry operation failed, derived from `pass` stderr content. */
type EntriesFailureKind = "not-found" | "exists" | "parse" | "failed";

/**
 * Error thrown by entry read operations (`list`, `show`).
 * `kind` preserves the stderr-derived distinction (missing entry vs
 * parse failure vs generic failure) so callers can tailor messages.
 */
class EntriesReadError extends Error {
  public path: string;
  public kind: EntriesFailureKind;
  public cause: Error | null;

  constructor(
    path: string,
    kind: EntriesFailureKind,
    message: string,
    cause?: Error
  ) {
    super(message, cause ? { cause } : undefined);
    this.path = path;
    this.kind = kind;
    this.cause = cause ?? null;
  }
}

/**
 * Error thrown by entry mutation operations (`insert`, `generate`,
 * `remove`, `copy`, `move`, `edit`). Same shape as `EntriesReadError`
 * but a distinct type so call sites can match on the operation family.
 */
class EntriesWriteError extends Error {
  public path: string;
  public kind: EntriesFailureKind;
  public cause: Error | null;

  constructor(
    path: string,
    kind: EntriesFailureKind,
    message: string,
    cause?: Error
  ) {
    super(message, cause ? { cause } : undefined);
    this.path = path;
    this.kind = kind;
    this.cause = cause ?? null;
  }
}

/**
 * Maps a `pass.exec()` error to an `EntriesReadError` for read operations.
 * Pass exits with code 1 for "entry not found"; stderr content disambiguates.
 */
function mapReadError(err: CommandFailedError | Error, path: string): EntriesReadError {
  if (
    err instanceof CommandFailedError &&
    err.stdErr.includes("is not in the password store")
  ) {
    return new EntriesReadError(
      path,
      "not-found",
      `Entry not found: ${err.stdErr}`,
      err
    );
  }
  return new EntriesReadError(path, "failed", err.message, err);
}

/**
 * Maps a `pass.exec()` error to an `EntriesWriteError` for mutations.
 * Pass exits with code 1 for "entry not found" and code 255 for general
 * failures; stderr content disambiguates further.
 */
function mapWriteError(
  err: CommandFailedError | Error,
  path: string
): EntriesWriteError {
  if (err instanceof CommandFailedError) {
    if (err.stdErr.includes("is not in the password store")) {
      return new EntriesWriteError(
        path,
        "not-found",
        `Entry not found: ${err.stdErr}`,
        err
      );
    }
    if (err.stdErr.includes("already exists")) {
      return new EntriesWriteError(
        path,
        "exists",
        `Entry already exists: ${path}`,
        err
      );
    }
  }
  return new EntriesWriteError(path, "failed", err.message, err);
}

/**
 * Service for password entry CRUD operations.
 * All methods delegate to `pass.exec()` which sets `PASSWORD_STORE_DIR`
 * and `GNUPGHOME` automatically. Returns `Result` types — never throws.
 */
class Entries {
  /**
   * Lists all entries in the password store as a nested tree.
   * Uses `walkStore()` which reads the filesystem directly — no `pass ls` parsing.
   */
  static async list(): Promise<Result<EntryTree, EntriesReadError>> {
    const storePath = Pass.storePath;
    if (!storePath) {
      return Err(new EntriesReadError("", "failed", "No active store configured"));
    }

    const tree = await walkStore(storePath);
    if (tree.isError()) {
      return Err(
        new EntriesReadError("", "failed", tree.error.message, tree.error)
      );
    }
    return Ok(tree.ok);
  }

  /**
   * Shows the contents of a password entry.
   * Runs `pass show <path>` and parses the output into structured fields.
   */
  static async show(
    path: string
  ): Promise<Result<EntryDetail, EntriesReadError>> {
    const result = await Pass.exec(["show", path]);
    if (result.isError()) {
      return Err(mapReadError(result.error, path));
    }

    const parsed = parsePassShowOutput(result.ok.stdOut, path);
    if (parsed.isError()) {
      return Err(new EntriesReadError(path, "parse", parsed.error.message));
    }

    return Ok(parsed.ok);
  }

  /**
   * Creates a new password entry. Fails with `kind: "exists"` on the
   * `EntriesWriteError` if the entry already exists (unless `force: true`).
   */
  static async insert(
    input: MutationInput
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    const args = ["insert"];
    if (input.force) args.push("-f");
    args.push("-m", input.path);

    const result = await Pass.exec(args, { stdIn: input.content });
    if (result.isError()) {
      return Err(mapWriteError(result.error, input.path));
    }

    return Ok({ success: true, path: input.path });
  }

  /**
   * Generates a new password and inserts it into the store.
   *
   * If `memorable` is true, generates locally using the EFF wordlist
   * (format: `NNNN-word-word-word`) and inserts via `pass insert -f`.
   * Otherwise, delegates to `pass generate` with the configured length.
   */
  static async generate(
    path: string,
    options?: {
      length?: number;
      symbols?: boolean;
      memorable?: boolean;
    }
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    let result: Result<ExecCommandResult, CommandFailedError | Error>;
    if (options?.memorable) {
      result = await Pass.exec(["insert", "-f", path], {
        stdIn: generateMemorablePassword(),
      });
    } else {
      result = await Pass.exec(["generate", "-f", path]);
    }
    if (result.isError()) {
      return Err(mapWriteError(result.error, path));
    }

    return Ok({ success: true, path });
  }

  /**
   * Removes a password entry from the store.
   * Uses `pass rm -rf` to handle both files and directories.
   */
  static async remove(
    path: string
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    const result = await Pass.exec(["rm", "-rf", path]);
    if (result.isError()) {
      return Err(mapWriteError(result.error, path));
    }

    return Ok({ success: true, path });
  }

  /**
   * Copies a password entry from one path to another.
   * Both oldPath and newPath are store-relative.
   */
  static async copy(
    oldPath: string,
    newPath: string
  ): Promise<
    Result<MutationResult, EntriesReadError | EntriesWriteError>
  > {
    const showResult = await Entries.show(oldPath);
    if (showResult.isError()) return Err(showResult.error);

    const insertResult = await Entries.insert({
      path: newPath,
      content: showResult.ok.raw,
      force: false,
    });
    if (insertResult.isError()) return Err(insertResult.error);

    return Ok({ success: true, path: newPath, oldPath });
  }

  /**
   * Moves or renames a password entry.
   * Both oldPath and newPath are store-relative.
   */
  static async move(
    oldPath: string,
    newPath: string
  ): Promise<Result<MutationResult, EntriesWriteError>> {
    const result = await Pass.exec(["mv", oldPath, newPath]);
    if (result.isError()) {
      return Err(mapWriteError(result.error, newPath));
    }

    return Ok({ success: true, path: newPath, oldPath });
  }

  /**
   * Edits an existing entry by verifying it exists, then reinserting.
   */
  static async edit(
    path: string,
    content: string
  ): Promise<Result<MutationResult, EntriesReadError | EntriesWriteError>> {
    const exists = await Entries.show(path);
    if (exists.isError()) return Err(exists.error);

    const result = await Entries.insert({ path, content, force: true });
    if (result.isError()) return Err(result.error);

    return Ok({ success: true, path });
  }
}

export { Entries, EntriesReadError, EntriesWriteError };
