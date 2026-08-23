import { Err, Ok, type Result } from "lib-result";
import type { EntryDetail } from "@/types/entries";
import { EntryParseError } from "./errors";

/**
 * Parses the stdout of `pass show <path>` into a structured EntryDetail.
 *
 * pass show output format:
 *   line 1: secret (password value)
 *   line 2+: optional metadata as "key: value" pairs, or other lines
 *
 * @example
 * ```ts
 * const result = parsePassShowOutput("my-pass\nusername: john\nURL: https://example.com\n");
 * // Ok({ secret: "my-pass", metadata: { username: "john", URL: "https://example.com" }, other: [], ... })
 * ```
 */
function parsePassShowOutput(
  stdout: string,
  path = ""
): Result<EntryDetail, EntryParseError> {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return Err(new EntryParseError(stdout, "Empty pass show output"));
  }

  const lines = trimmed.split("\n");

  // First non-empty line is the secret
  const secret = lines[0] as string;
  const metadata: Record<string, string> = {};
  const other: string[] = [];

  // Parse remaining lines
  let hasOtpUri = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] as string;

    // First standalone OTP URI line goes to other; later OTP URIs also go to other.
    if (!hasOtpUri && line.startsWith("otpauth://")) {
      hasOtpUri = true;
      other.push(line);
      continue;
    }

    const colonIndex = line.indexOf(":");

    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      // Preserve inline comments — entry content is user data, and the
      // edit round-trip must not silently drop it. (Inline comments are
      // only stripped in `.gpg-id` parsing, per pass spec.)
      const value = line.slice(colonIndex + 1).trim();

      if (key.length > 0 && value.length > 0) {
        metadata[key] = value;
      } else other.push(line);
    } else other.push(line);
  }

  return Ok({
    path,
    secret,
    metadata,
    other,
    raw: stdout,
  });
}

export { parsePassShowOutput };
