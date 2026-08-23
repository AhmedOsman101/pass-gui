import { Err, ErrFromText, Ok, type Result } from "lib-result";
import { stripInlineComment } from "@/lib/utils";
import { Fs } from "./filesystem";
import { Gpg } from "./gpg";
import { Pass } from "./pass";

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
 * Result of full store validation.
 * - `exists`: directory exists on disk
 * - `initialized`: has a `.gpg-id` file (is a pass store)
 * - `recipients`: parsed recipients from `.gpg-id` (only if initialized)
 * - `missingKeys`: key IDs not found in the keyring (only if initialized)
 * - `hasEntries`: store contains `.gpg` password files (only if initialized)
 */
type StoreValidationResult = {
  exists: boolean;
  initialized: boolean;
  recipients?: ParsedRecipient[];
  missingKeys?: string[];
  hasEntries?: boolean;
};

/**
 * Service for validating password stores before use.
 * Handles `.gpg-id` parsing, recipient verification against the GPG keyring,
 * behavioral checks via `pass ls`, and entry scanning for `.gpg` files.
 *
 * All methods are static and return `Result` types.
 */
class StoreValidation {
  /**
   * Full validation of a store path. Checks directory existence,
   * `.gpg-id` presence, recipient verification, and entry scanning.
   * Returns a structured result with all findings.
   */
  static async validate(
    storePath: string,
    gnupgHome?: string
  ): Promise<Result<StoreValidationResult>> {
    // 1. Check if directory exists
    const dirExists = await Fs.isDirectory(storePath);
    if (dirExists.isError()) return Err(dirExists.error);

    if (!dirExists.ok) {
      return Ok({ exists: false, initialized: false });
    }

    // 2. Check if .gpg-id exists (initialized store)
    const gpgIdPath = await Fs.join(storePath, ".gpg-id");
    const gpgIdExists = await Fs.isFile(gpgIdPath);
    if (gpgIdExists.isError()) return Err(gpgIdExists.error);

    if (!gpgIdExists.ok) {
      return Ok({ exists: true, initialized: false });
    }

    // 3. Parse .gpg-id and verify recipients
    const recipients = await StoreValidation.parseGpgId(storePath);
    if (recipients.isError()) return Err(recipients.error);

    const verification = await StoreValidation.verifyRecipients(
      recipients.ok,
      gnupgHome
    );
    if (verification.isError()) return Err(verification.error);

    // 4. Check for entries
    const entries = await StoreValidation.hasEntries(storePath);
    if (entries.isError()) return Err(entries.error);

    return Ok({
      exists: true,
      initialized: true,
      recipients: recipients.ok,
      missingKeys: verification.ok.missingKeys,
      hasEntries: entries.ok,
    });
  }
  /**
   * Parses a `.gpg-id` file and extracts recipient key IDs.
   * Strips end-of-line comments (pass uses `${gpg_id%%#*}` style),
   * skips blank lines and comment-only lines, and identifies hex
   * fingerprints (40-char hex strings).
   */
  static async parseGpgId(
    storePath: string
  ): Promise<Result<ParsedRecipient[]>> {
    const path = await Fs.join(storePath, ".gpg-id");

    const readResult = await Fs.readFile(path);
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
        ? await Gpg.listSecretKeysWithHome(gnupgHome)
        : await Gpg.listSecretKeys();

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

    const output = await Pass.exec(["ls"], { envs });
    if (output.isError()) return Err(output.error);
    return Ok(undefined);
  }

  /**
   * Checks whether a password store contains any `.gpg` entries.
   * Uses flat directory output and `.some()` to short-circuit on the
   * first match — no tree building, no recursion needed.
   */
  static async hasEntries(storePath: string): Promise<Result<boolean>> {
    const result = await Fs.readDirectory(storePath, {
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

export { StoreValidation };
