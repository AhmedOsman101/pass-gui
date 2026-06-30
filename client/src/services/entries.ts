import { Err, ErrFromText, Ok, type Result } from "lib-result";
import {
  CommandFailedError,
  EntryAlreadyExistsError,
  EntryNotFoundError,
  MutationError,
} from "@/lib/errors";
import {
  generateMemorablePassword,
  generatePassword,
} from "@/lib/generate-password";
import { parsePassShowOutput } from "@/lib/parse-pass-show";
import { walkStore } from "@/lib/store-walker";
import type {
  EntryDetail,
  EntryTree,
  MutationInput,
  MutationResult,
} from "@/types/entries";
import { pass } from "./pass";

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
class EntriesService {
  /**
   * Returns the active store path, with tilde resolved.
   * Falls back to `pass.storeDirectory` if config doesn't have one yet.
   */
  private getActiveStorePath(): Result<string> {
    const storePath = pass.storeDirectory;
    if (!storePath) {
      return ErrFromText("No active store configured");
    }
    return Ok(storePath);
  }

  /**
   * Lists all entries in the password store as a nested tree.
   * Uses `walkStore()` which reads the filesystem directly — no `pass ls` parsing.
   */
  async list(): Promise<Result<EntryTree, MutationError | Error>> {
    const storePath = await this.getActiveStorePath();
    if (storePath.isError()) return Err(storePath.error);

    return await walkStore(storePath.ok);
  }

  /**
   * Shows the contents of a password entry.
   * Runs `pass show <path>` and parses the output into structured fields.
   */
  async show(
    path: string
  ): Promise<
    Result<EntryDetail, EntryNotFoundError | MutationError | CommandFailedError>
  > {
    const result = await pass.exec(["show", path]);
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
    }

    const parsed = parsePassShowOutput(result.ok.stdOut, path);
    if (parsed.isError()) {
      return Err(new MutationError(-1, result.ok.stdOut, parsed.error.message));
    }

    return Ok(parsed.ok);
  }

  /**
   * Creates a new password entry. Fails with `EntryAlreadyExistsError`
   * if the entry already exists (unless `force: true`).
   */
  async insert(
    input: MutationInput
  ): Promise<Result<MutationResult, EntryAlreadyExistsError | MutationError>> {
    const args = ["insert"];
    if (input.force) args.push("-f");
    args.push("-m", input.path);

    const result = await pass.exec(args, { stdIn: input.content });
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
  async generate(
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
    let content: string;

    if (options?.memorable) {
      content = generateMemorablePassword();
    } else {
      const charset = options?.symbols ? "[:punct:][:alnum:]" : "[:alnum:]";
      const length = options?.length ?? 25;
      content = generatePassword(length, charset);
    }

    const result = await pass.exec(["generate", "-f", "-p", path], {
      stdIn: content,
    });
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
    }

    return Ok({ success: true, path });
  }

  /**
   * Removes a password entry from the store.
   * Uses `pass rm -f` to skip confirmation prompts.
   */
  async remove(
    path: string
  ): Promise<
    Result<
      MutationResult,
      MutationError | EntryNotFoundError | EntryAlreadyExistsError
    >
  > {
    const result = await pass.exec(["rm", "-f", path]);
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
    }

    return Ok({ success: true, path });
  }

  /**
   * Moves or renames a password entry.
   * Both oldPath and newPath are store-relative.
   */
  async move(
    oldPath: string,
    newPath: string
  ): Promise<
    Result<
      MutationResult,
      MutationError | EntryNotFoundError | EntryAlreadyExistsError
    >
  > {
    const result = await pass.exec(["mv", oldPath, newPath]);
    if (result.isError()) {
      const mapped = mapPassError(result.error);
      return Err(mapped);
    }

    return Ok({ success: true, path: newPath, oldPath });
  }

  /**
   * Edits an existing entry by verifying it exists, then reinserting.
   */
  async edit(
    path: string,
    content: string
  ): Promise<
    Result<
      MutationResult,
      EntryNotFoundError | MutationError | CommandFailedError
    >
  > {
    const exists = await this.show(path);
    if (exists.isError()) return Err(exists.error);

    const result = await this.insert({ path, content, force: true });
    if (result.isError()) return Err(result.error);

    return Ok({ success: true, path });
  }
}

const entries = new EntriesService();

export { EntriesService, entries };
