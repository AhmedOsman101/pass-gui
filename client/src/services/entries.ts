import type { ExecCommandResult } from "@neutralinojs/lib";
import { Err, ErrFromText, Ok, type Result } from "lib-result";
import {
  CommandFailedError,
  EntryAlreadyExistsError,
  EntryNotFoundError,
  MutationError,
} from "@/lib/errors";
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

/**
 * Maps a `pass.exec()` error to a domain-specific error.
 * Pass exits with code 1 for "entry not found" and code 255 for
 * general failures. Stderr content disambiguates further.
 */
function mapPassError(
  err: CommandFailedError | Error
): MutationError | EntryNotFoundError | EntryAlreadyExistsError {
  if (err instanceof CommandFailedError) {
    if (err.stdErr.includes("is not in the password store")) {
      return new EntryNotFoundError(
        "(unknown)",
        `Entry not found: ${err.stdErr}`
      );
    }
    if (err.stdErr.includes("already exists")) {
      return new EntryAlreadyExistsError("(unknown)");
    }
    return new MutationError(err.exitCode, err.stdErr, err.message);
  }
  return new MutationError(-1, err.message, err.message);
}

/**
 * Service for password entry CRUD operations.
 * All methods delegate to `pass.exec()` which sets `PASSWORD_STORE_DIR`
 * and `GNUPGHOME` automatically. Returns `Result` types — never throws.
 */
class Entries {
  /**
   * Returns the active store path, with tilde resolved.
   * Falls back to `pass.storePath` if config doesn't have one yet.
   */
  private static getActiveStorePath(): Result<string> {
    const storePath = Pass.storePath;
    if (!storePath) {
      return ErrFromText("No active store configured");
    }
    return Ok(storePath);
  }

  /**
   * Lists all entries in the password store as a nested tree.
   * Uses `walkStore()` which reads the filesystem directly — no `pass ls` parsing.
   */
  static async list(): Promise<Result<EntryTree, MutationError | Error>> {
    const storePath = Entries.getActiveStorePath();
    if (storePath.isError()) return Err(storePath.error);

    return await walkStore(storePath.ok);
  }

  /**
   * Shows the contents of a password entry.
   * Runs `pass show <path>` and parses the output into structured fields.
   */
  static async show(
    path: string
  ): Promise<
    Result<EntryDetail, EntryNotFoundError | MutationError | CommandFailedError>
  > {
    const result = await Pass.exec(["show", path]);
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
    }

    const parsed = parsePassShowOutput(result.ok.stdOut, path);
    if (parsed.isError()) {
      return Err(new MutationError(-1, result.ok.stdErr, parsed.error.message));
    }

    return Ok(parsed.ok);
  }

  /**
   * Creates a new password entry. Fails with `EntryAlreadyExistsError`
   * if the entry already exists (unless `force: true`).
   */
  static async insert(
    input: MutationInput
  ): Promise<Result<MutationResult, EntryAlreadyExistsError | MutationError>> {
    const args = ["insert"];
    if (input.force) args.push("-f");
    args.push("-m", input.path);

    const result = await Pass.exec(args, { stdIn: input.content });
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
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
  ): Promise<
    Result<
      MutationResult,
      MutationError | EntryNotFoundError | EntryAlreadyExistsError
    >
  > {
    let result: Result<ExecCommandResult, CommandFailedError | Error>;
    if (options?.memorable) {
      result = await Pass.exec(["insert", "-f", path], {
        stdIn: generateMemorablePassword(),
      });
    } else {
      result = await Pass.exec(["generate", "-f", path]);
    }
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
    }

    return Ok({ success: true, path });
  }

  /**
   * Removes a password entry from the store.
   * Uses `pass rm -rf` to handle both files and directories.
   */
  static async remove(
    path: string
  ): Promise<
    Result<
      MutationResult,
      MutationError | EntryNotFoundError | EntryAlreadyExistsError
    >
  > {
    const result = await Pass.exec(["rm", "-rf", path]);
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
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
    Result<
      MutationResult,
      | MutationError
      | EntryNotFoundError
      | EntryAlreadyExistsError
      | CommandFailedError
    >
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
  ): Promise<
    Result<
      MutationResult,
      MutationError | EntryNotFoundError | EntryAlreadyExistsError
    >
  > {
    const result = await Pass.exec(["mv", oldPath, newPath]);
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
    }

    return Ok({ success: true, path: newPath, oldPath });
  }

  /**
   * Edits an existing entry by verifying it exists, then reinserting.
   */
  static async edit(
    path: string,
    content: string
  ): Promise<
    Result<
      MutationResult,
      EntryNotFoundError | MutationError | CommandFailedError
    >
  > {
    const exists = await Entries.show(path);
    if (exists.isError()) return Err(exists.error);

    const result = await Entries.insert({ path, content, force: true });
    if (result.isError()) return Err(result.error);

    return Ok({ success: true, path });
  }
}

export { Entries };
