import { Err, ErrFromText, Ok, type Result } from "lib-result";
import { stripInlineComment } from "@/lib/utils";
import { fs } from "./filesystem";
import { gpg } from "./gpg";
import { pass } from "./pass";

/**
 * A parsed recipient entry from a `.gpg-id` file.
 * - `raw`: the original line (with comment stripped)
 * - `keyId`: the GPG key ID or fingerprint
 * - `isFingerprint`: true if `keyId` is a 40-character hex fingerprint
 */
type ParsedRecipient = { raw: string; keyId: string; isFingerprint: boolean };

/**
 * Result of recipient verification against the GPG keyring.
 * - `recipients`: the parsed recipients from `.gpg-id`
 * - `missingKeys`: key IDs not found in the keyring
 */
type RecipientValidation = {
  recipients: ParsedRecipient[];
  missingKeys: string[];
};

/**
 * Service for validating password stores before use.
 * Handles `.gpg-id` parsing, recipient verification against the GPG keyring,
 * behavioral checks via `pass ls`, and entry scanning for `.gpg` files.
 *
 * All methods are static and return `Result` types.
 */
class StoreValidationService {
  /**
   * Parses a `.gpg-id` file and extracts recipient key IDs.
   * Strips end-of-line comments (pass uses `${gpg_id%%#*}` style),
   * skips blank lines and comment-only lines, and identifies hex
   * fingerprints (40-char hex strings).
   */
  static async parseGpgId(
    storePath: string
  ): Promise<Result<ParsedRecipient[]>> {
    const path = await fs.join(storePath, ".gpg-id");
    const fileExists = await fs.isFile(path);
    if (fileExists.isError()) return Err(fileExists.error);

    const readResult = await fs.readFile(path);
    if (readResult.isError()) return Err(readResult.error);

    const lines = readResult.ok
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("#"));

    const recipients: ParsedRecipient[] = [];

    for (const line of lines) {
      const keyId = stripInlineComment(line);

      if (keyId.length === 0) continue;

      recipients.push({
        raw: line,
        keyId,
        isFingerprint: /^[0-9a-f]{40}$/i.test(keyId),
      });
    }

    if (recipients.length) return Ok(recipients);
    return ErrFromText("No valid key IDs found");
  }

  /**
   * Verifies that all recipients in `.gpg-id` exist in the GPG keyring.
   * For full fingerprints, performs an exact match. For short IDs, matches
   * as a suffix against both `key.fingerprint` and `key.keyId`.
   * Optionally uses a custom GNUPGHOME for the keyring lookup.
   */
  static async verifyRecipients(
    recipients: ParsedRecipient[],
    gnupgHome?: string
  ): Promise<Result<RecipientValidation>> {
    const secretKeys =
      gnupgHome && gnupgHome.length > 0
        ? await gpg.listSecretKeysWithHome(gnupgHome)
        : await gpg.listSecretKeys();

    if (secretKeys.isError()) return Err(secretKeys.error);

    const keys = secretKeys.ok;
    const missingKeys: string[] = [];

    for (const recipient of recipients) {
      const found = keys.some(key => {
        if (recipient.isFingerprint) {
          return key.fingerprint === recipient.keyId;
        }
        return (
          key.fingerprint?.endsWith(recipient.keyId) ||
          key.keyId.endsWith(recipient.keyId)
        );
      });

      if (!found) missingKeys.push(recipient.keyId);
    }

    return Ok({ recipients, missingKeys });
  }

  /**
   * Validates a store operationally by running `pass ls` against it.
   * This catches issues that static checks miss (e.g. GPG agent problems,
   * corrupted store, missing secret keys). Uses NeutralinoJS native `envs`
   * to set `PASSWORD_STORE_DIR` and optionally `GNUPGHOME`.
   */
  static async validateBehavior(
    storePath: string,
    gnupgHome?: string
  ): Promise<Result<undefined>> {
    const envs: Record<string, string> = { PASSWORD_STORE_DIR: storePath };
    if (gnupgHome) envs.GNUPGHOME = gnupgHome;

    const output = await pass.exec(["ls"], { envs });
    if (output.isError()) return Err(output.error);
    return Ok(undefined);
  }

  /**
   * Checks whether a password store contains any `.gpg` entries.
   * Uses flat directory output and `.some()` to short-circuit on the
   * first match — no tree building, no recursion needed.
   */
  static async hasEntries(storePath: string): Promise<Result<boolean>> {
    const result = await fs.readDirectory(storePath, {
      recursive: true,
      flat: true,
    });
    if (result.isError()) return Err(result.error);

    return Ok(
      result.ok.some(
        entry => entry.type === "FILE" && entry.entry.endsWith(".gpg")
      )
    );
  }
}

export { StoreValidationService };
