import * as TOML from "@ltd/j-toml";
import { type Result, wrapThrowable } from "lib-result";
import type { ParsedToml, TomlObject, TomlStringified } from "@/types/toml";

/** Internal type: ReadonlyTable accepted by j-toml's stringify */
type ReadonlyTable = Parameters<typeof TOML.stringify>[0];
/** Internal type: Table returned by j-toml's parse */
type Table = ReturnType<typeof TOML.parse>;

/** Wrapped stringify that returns Result instead of throwing */
const safeStringify = wrapThrowable(TOML.stringify);
/** Wrapped parse that returns Result instead of throwing */
const safeParse = wrapThrowable(TOML.parse);

/**
 * Converts a value to TOML string format.
 * Returns a branded TomlStringified<T> that guarantees valid TOML.
 * @example
 * const result = toml.stringify({ name: "test", count: 42 });
 * if (result.isOk()) {
 *   // result.ok is TomlStringified<{ name: string; count: number }>
 *   console.log(result.ok);
 * }
 * @param value - TOML-compatible object or ParsedToml for round-trip
 * @returns Result containing branded TomlStringified<T>
 */
function stringify<T extends object>(value: T): Result<TomlStringified<T>>;
/**
 * Converts a ParsedToml back to TOML string, preserving metadata.
 * @example
 * const parsed = toml.parse(rawTomlString);
 * if (parsed.isOk()) {
 *   const roundTripped = toml.stringify(parsed.ok);
 *   // Round-trip preserves comments and key order
 * }
 * @param value - ParsedToml from a previous parse call
 * @returns Result containing branded TomlStringified<T>
 */
function stringify<T>(value: ParsedToml<T>): Result<TomlStringified<T>>;
function stringify<T>(value: T | ParsedToml<T>): Result<TomlStringified<T>> {
  let table: ReadonlyTable;
  // If value has _raw, treat as ParsedToml
  if (typeof value === "object" && value !== null && "_raw" in value) {
    table = value._raw as ReadonlyTable;
  } else table = value as ReadonlyTable;

  const result = safeStringify(table, {
    newline: "\n",
    newlineAround: "section",
    indent: 2,
  });

  // Creates a branded TOML string - only exported for use by stringify
  return result.map(tomlString => tomlString as TomlStringified<T>);
}

/**
 * Parses a TOML string into a structured result.
 * Preserves raw Table for round-trip metadata (comments, order).
 * @example
 * const result = toml.parse<{ name: string }>(tomlString);
 * if (result.isOk()) {
 *   console.log(result.ok.data);  // { name: "value" }
 *   console.log(result.ok._raw);   // Raw Table for re-stringifying
 * }
 * @param source - Raw TOML string (e.g., from file read) or TomlStringified<T>
 * @returns Result containing ParsedToml<T> with data and _raw, or error
 */
function parse<T>(source: string | TomlStringified<T>): Result<ParsedToml<T>> {
  const result = safeParse(source, {
    bigint: true,
    joiner: "\n",
    x: { comment: true, order: true },
  });

  // Extract clean data from the Table, filtering out symbol keys (comments, order)
  return result.map(table => ({
    data: extractCleanData<T>(table),
    _raw: table,
  }));
}

/**
 * Extracts clean data from a j-toml Table, excluding symbol keys.
 * Symbol keys contain metadata like comments and key order.
 * @param table - Raw j-toml Table with possible symbol keys
 * @returns Clean object with only string keys and TOML values
 */
function extractCleanData<T>(table: Table): TomlObject<T> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(table)) {
    const value = table[key];

    if (value === null) {
      result[key] = null;
    } else if (typeof value === "object") {
      // Check for DateTime types
      if (Symbol.toStringTag in value) {
        // Preserve DateTime objects as-is
        result[key] = value;
      } else if (Array.isArray(value)) {
        // Recursively process arrays
        result[key] = value.map(item =>
          typeof item === "object" && item !== null
            ? extractCleanData(item as Table)
            : item
        );
      } else {
        // Nested table - recursively extract
        result[key] = extractCleanData(value as Table);
      }
    } else {
      // Primitives (string, number, boolean, bigint)
      result[key] = value;
    }
  }

  return result as TomlObject<T>;
}

export default {
  stringify,
  parse,
};
