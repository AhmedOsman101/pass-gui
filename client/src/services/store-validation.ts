import { Err, ErrFromText, Ok, type Result } from "lib-result";
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
    const path = `${storePath}/.gpg-id`;
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
      const commentIdx = line.indexOf("#");
      const keyId =
        commentIdx === -1 ? line : line.substring(0, commentIdx).trim();

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
    // biome-ignore lint/suspicious/noExplicitAny: Controlled behavior
    const envs: any = { PASSWORD_STORE_DIR: storePath };
    if (gnupgHome) envs.GNUPGHOME = gnupgHome;

    const output = await pass.execScoped(["ls"], { envs });
    if (output.isError()) return Err(output.error);
    return Ok(undefined);
  }

  /**
   * Checks whether a password store contains any `.gpg` entries.
   * Scans the directory tree recursively using `fs.readDirectory`
   * and looks for files ending in `.gpg`. Used to distinguish between
   * `STORE_EMPTY` (info) and other blocking states.
   */
  static async hasEntries(storePath: string): Promise<Result<boolean>> {
    const result = await fs.readDirectory(storePath, { recursive: true });
    if (result.isError()) return Err(result.error);

    const hasGpgFiles = result.ok.some(
      entry => entry.type === "FILE" && entry.entry.endsWith(".gpg")
    );
    return Ok(hasGpgFiles);
  }
}

export { StoreValidationService };
