import { WORD_LIST } from "./wordlist";

/**
 * Cryptographically secure random integer in [0, max).
 * Uses `crypto.getRandomValues` which is available in both
 * browser and NeutralinoJS contexts.
 */
function secureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] as number) % max;
}

/**
 * Generates a memorable passphrase in the format `NNNN-word-word-word`.
 *
 * Uses the combined EFF short wordlists (2448 words) for the word portion.
 * The 4-digit prefix provides ~13.3 bits, each word ~11.3 bits.
 * Total: ~47.1 bits of entropy — suitable for memorable passwords.
 *
 * @example
 * ```ts
 * generateMemorablePassword() // "2787-brave-buffalo-sabrina"
 * ```
 */
export function generateMemorablePassword(): string {
  const digits = String(secureRandomInt(10_000)).padStart(4, "0");
  const w1 = WORD_LIST[secureRandomInt(WORD_LIST.length)] as string;
  const w2 = WORD_LIST[secureRandomInt(WORD_LIST.length)] as string;
  const w3 = WORD_LIST[secureRandomInt(WORD_LIST.length)] as string;
  return `${digits}-${w1}-${w2}-${w3}`;
}

/**
 * Generates a random password using the specified character set.
 * Uses `crypto.getRandomValues` for CSPRNG security.
 *
 * @param length - Password length (8–128)
 * @param charset - Character set to draw from (POSIX bracket notation)
 */
export function generatePassword(length: number, charset: string): string {
  const chars = expandCharSet(charset);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[secureRandomInt(chars.length)] as string;
  }
  return result;
}

/**
 * Expands POSIX bracket expressions into a flat character string.
 * Supports `[[:punct:]]`, `[[:alnum:]]`, `[[:alpha:]]`, `[[:digit:]]`, `[[:space:]]`.
 * Falls back to literal characters for unrecognized brackets.
 */
function expandCharSet(set: string): string {
  const posixClasses: Record<string, string> = {
    "[[:punct:]]": "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
    "[[:alnum:]]":
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    "[[:alpha:]]": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "[[:digit:]]": "0123456789",
    "[[:space:]]": " \t\n\r\v\f",
  };

  let result = "";
  let i = 0;
  while (i < set.length) {
    if (set[i] === "[" && set[i + 1] === "[") {
      const end = set.indexOf("]]", i);
      if (end !== -1) {
        const className = set.slice(i, end + 2);
        const expanded = posixClasses[className];
        if (expanded) {
          result += expanded;
          i = end + 2;
          continue;
        }
      }
    }
    result += set[i] as string;
    i++;
  }
  return result;
}
