import * as TOML from "@ltd/j-toml";
import { type Result, wrapThrowable } from "lib-result";
import type { AppConfig, StoreConfig } from "@/types/config";
import type { ParsedToml, TomlObject, TomlStringified } from "@/types/toml";

/** Internal type: ReadonlyTable accepted by j-toml's stringify */
type ReadonlyTable = Parameters<typeof TOML.stringify>[0];
/** Internal type: Table returned by j-toml's parse */
type Table = ReturnType<typeof TOML.parse>;
type MetadataTable = Table & Record<symbol, unknown>;

type ConfigCommentMap<TConfig extends ReadonlyTable> = {
  section: string;
  keys: Partial<Record<keyof TConfig, string>>;
};

/** Wrapped stringify that returns Result instead of throwing */
const safeStringify = wrapThrowable(TOML.stringify);
/** Wrapped parse that returns Result instead of throwing */
const safeParse = wrapThrowable(TOML.parse);

/**
 * Converts a config object to use section format for TOML output.
 * Transforms { core: {...}, preferences: {...} } into a Table where
 * each section becomes a proper TOML section (not dotted keys).
 * @param config - The config object to transform
 * @returns Table with sections in proper TOML section format
 */
function toSectionFormat<T extends object>(config: T): Table {
  const result: Table = {};
  for (const [section, values] of Object.entries(config)) {
    if (values && typeof values === "object") {
      result[section] = TOML.Section({ ...values });
    } else {
      result[section] = values;
    }
  }
  return result;
}

function createSectionTable(values: ReadonlyTable): MetadataTable {
  return TOML.Section({ ...values }) as MetadataTable;
}

function addKeyComment(
  table: MetadataTable,
  key: string,
  comment: string | undefined
): void {
  if (!comment) return;
  table[TOML.commentFor(key)] = comment;
}

function createCommentedSection<TConfig extends ReadonlyTable>(
  values: TConfig,
  comments: ConfigCommentMap<TConfig>
): MetadataTable {
  const section = createSectionTable(values);
  section[TOML.commentForThis] = comments.section;

  for (const key of Object.keys(comments.keys) as Array<
    keyof TConfig & string
  >) {
    addKeyComment(section, key, comments.keys[key]);
  }

  return section;
}

function createCommentedStoreSection(
  storeName: string,
  store: StoreConfig
): MetadataTable {
  return createCommentedSection(store, {
    section: ` Default store settings (${storeName}).`,
    keys: {
      path: ` Password store path. Default: "${store.path}".`,
      gnupg_home: " Optional custom GNUPGHOME for this store. Default: unset.",
    },
  });
}

function buildDefaultConfigTable(config: AppConfig): ReadonlyTable {
  const stores = createSectionTable({});
  stores[TOML.commentForThis] = " Configured password stores.";

  for (const [storeName, store] of Object.entries(config.stores)) {
    stores[storeName] = createCommentedStoreSection(storeName, store);
  }

  return {
    core: createCommentedSection(config.core, {
      section: " Active application settings.",
      keys: {
        active_store: ` Which store is currently used. Default: "${config.core.active_store}".`,
      },
    }),
    preferences: createCommentedSection(config.preferences, {
      section: " UI behavior preferences.",
      keys: {
        auto_refresh_interval_ms: ` Refresh interval in ms. Default: ${config.preferences.auto_refresh_interval_ms}.`,
      },
    }),
    generation: createCommentedSection(config.generation, {
      section: " Default password generation options.",
      keys: {
        default_length: ` Generated password length. Default: ${config.generation.default_length}.`,
        symbols: ` Include symbols by default. Default: ${String(config.generation.symbols)}.`,
        character_set: ` Charset when symbols are enabled. Default: "${config.generation.character_set}".`,
        character_set_no_symbols: ` Charset when symbols are disabled. Default: "${config.generation.character_set_no_symbols}".`,
      },
    }),
    clipboard: createCommentedSection(config.clipboard, {
      section: " Clipboard behavior after copy.",
      keys: {
        clear_after_seconds: ` Clear clipboard after seconds. Default: ${config.clipboard.clear_after_seconds}.`,
        selection: ` X selection to use: clipboard, primary, secondary. Default: "${config.clipboard.selection}".`,
      },
    }),
    gpg: createCommentedSection(config.gpg, {
      section: " Supported GPG-related pass defaults.",
      keys: {
        opts: " Extra GPG options passed to pass. Default: [].",
        signing_key:
          " Optional signing key for pass operations. Default: unset.",
        key: " Optional recipient override key. Default: unset.",
      },
    }),
    extensions: createCommentedSection(config.extensions, {
      section: " pass extension support.",
      keys: {
        enabled: ` Enable pass extensions. Default: ${String(config.extensions.enabled)}.`,
      },
    }),
    stores,
  } as ReadonlyTable;
}

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
function stringify<TData extends object>(
  value: TData
): Result<TomlStringified<TData>>;
function stringify<TData>(value: ReadonlyTable): Result<TomlStringified<TData>>;
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
function stringify<TData>(
  value: ParsedToml<TData>
): Result<TomlStringified<TData>>;
function stringify<TData>(
  value: TData | ParsedToml<TData> | ReadonlyTable
): Result<TomlStringified<TData>> {
  let table: ReadonlyTable;
  // If value has _raw, treat as ParsedToml
  if (typeof value === "object" && value !== null && "_raw" in value) {
    table = value._raw as ReadonlyTable;
  } else if (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).some(
      entry =>
        typeof entry === "object" && entry !== null && TOML.isSection(entry)
    )
  ) {
    table = value as ReadonlyTable;
  } else {
    table = toSectionFormat(value as object) as ReadonlyTable;
  }

  const result = safeStringify(table, {
    newline: "\n",
    newlineAround: "section",
    indent: 2,
  });

  // Creates a branded TOML string - only exported for use by stringify
  return result.map(tomlString => tomlString as TomlStringified<TData>);
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
function parse<TData>(
  source: string | TomlStringified<TData>
): Result<ParsedToml<TData>> {
  const result = safeParse(source, {
    bigint: false,
    joiner: "\n",
    x: { comment: true, order: true, string: true },
  });

  // Extract clean data from the Table, filtering out symbol keys (comments, order)
  return result.map(table => ({
    data: extractCleanData<TData>(table),
    _raw: table,
  }));
}

/**
 * Extracts clean data from a j-toml Table, excluding symbol keys.
 * Symbol keys contain metadata like comments and key order.
 * @param table - Raw j-toml Table with possible symbol keys
 * @returns Clean object with only string keys and TOML values
 */
function extractCleanData<TData>(table: Table): TomlObject<TData> {
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

  return result as TomlObject<TData>;
}

export default {
  buildDefaultConfigTable,
  stringify,
  parse,
};
