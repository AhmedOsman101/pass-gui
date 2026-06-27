import type * as TOML from "@ltd/j-toml";
import type { Brand, Stringifiable } from "./index";

/**
 * Recursive type that maps an object structure to TOML-compatible values.
 * Rejects functions, undefined, and non-stringifiable values at the type level.
 * @example
 * type Config = TomlObject<{ name: string; count: number }>;
 * // Valid: { name: string; count: number }
 */
type TomlObject<TData> = {
  [K in keyof TData as [TomlValue<TData[K]>] extends [never]
    ? never
    : K]: TomlValue<TData[K]>;
};

/**
 * Type representing a single TOML-compatible value.
 * - Primitives (string, number, boolean, bigint, null) pass through
 * - Functions and undefined are rejected (never)
 * - Objects are recursively mapped to TomlObject
 * @example
 * type V1 = TomlValue<string>;  // string
 * type V2 = TomlValue<number>;  // number
 * type V3 = TomlValue<undefined>;  // never
 * type V4 = TomlValue<{ a: string }>;  // { a: string }
 */
type TomlValue<T> = T extends Stringifiable
  ? T
  : // biome-ignore lint/suspicious/noExplicitAny: Represents a general function
    T extends undefined | ((...args: any[]) => any)
    ? never
    : T extends object
      ? TomlObject<T>
      : never;

/**
 * The raw Table type returned by j-toml's parse function.
 * Contains string keys for values and may contain symbol keys
 * for metadata (comments, order) when xOptions are enabled.
 */
type Table = ReturnType<typeof TOML.parse>;

/**
 * Branded string type that guarantees the string is valid TOML.
 * Can only be created by the stringify function - this brand ensures
 * type safety by preventing arbitrary strings from being used as TOML.
 * @example
 * const toml = tomlLib.stringify({ key: "value" });
 * // toml: TomlStringified<{ key: string }>
 */
type TomlStringified<TData> = Brand<string, TData>;

/**
 * Parsed TOML result containing both clean data and raw Table reference
 * for metadata preservation (comments, order, etc.)
 * @example
 * const result = tomlLib.parse<{ name: string }>(tomlString);
 * if (result.isOk()) {
 *   console.log(result.ok.data);  // Clean data object
 *   console.log(result.ok._raw);  // Raw Table for re-stringifying
 * }
 */
type ParsedToml<TData> = {
  /** Clean, cloneable data matching the original structure */
  data: TomlObject<TData>;
  /** Internal j-toml Table reference for round-trip metadata preservation */
  _raw: Table;
};

export type { ParsedToml, TomlObject, TomlStringified };
