import { Err, ErrFromText, Ok, type Result } from "lib-result";
import { fs } from "./filesystem";
import { gpg } from "./gpg";
import { pass } from "./pass";

type ParsedRecipient = { raw: string; keyId: string; isFingerprint: boolean };
type RecipientValidation = {
  recipients: ParsedRecipient[];
  missingKeys: string[];
};

class StoreValidationService {
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
