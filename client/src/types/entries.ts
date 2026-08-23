/**
 * Domain types for password entry operations.
 *
 * These types define the shared contract between the entry service layer
 * (EntriesService, ClipboardService) and the frontend Pinia stores.
 * They represent the parsed output of `pass ls` and `pass show` commands,
 * mutation inputs/results, and clipboard state.
 */

/**
 * A single node in the password store tree.
 * Directories have `children`; files do not.
 * `path` is the full store-relative path (e.g. `Email/work`).
 */
type EntryNode = {
  name: string;
  path: string;
  type: "FILE" | "DIRECTORY"; // Matches fs.readDirectory() type field.
  children?: EntryNode[];
};

/** The root of a password store tree — an array of top-level nodes. */
type EntryTree = EntryNode[];

/**
 * Parsed output of `pass show <path>`.
 * The first line is always the secret (password).
 * Subsequent lines are split into metadata key:value pairs
 * and arbitrary `other` lines.
 */
type EntryDetail = {
  /** Store-relative path (supplied to the parser). */
  path: string;
  /** The secret value — first line of `pass show` output. */
  secret: string;
  /** Key:value metadata parsed from subsequent lines (e.g. username, URL). */
  metadata: Record<string, string>;
  /** Lines that don't parse as key:value pairs. */
  other: string[];
  /** Full raw stdout from `pass show` for raw editing mode. */
  raw: string;
};

/**
 * Input for creating or overwriting a password entry.
 * Used by `EntriesService.insert()` and `EntriesService.edit()`.
 */
type MutationInput = {
  /** Store-relative path (e.g. `Email/work`). */
  path: string;
  /** The content to write — password on line 1, optional metadata below. */
  content: string;
  /** If `true`, overwrite an existing entry without error. */
  force?: boolean;
};

/**
 * Result of a successful mutation operation (insert, generate, remove, move).
 */
type MutationResult = {
  /** Whether the operation succeeded. */
  success: boolean;
  /** The affected store-relative path. */
  path: string;
  /** Previous path — only set for move/rename operations. */
  oldPath?: string;
};

/**
 * Which clipboard selection to target.
 * NeutralinoJS only supports `"clipboard"`.
 * `"primary"` and `"secondary"` silently fall back to `"clipboard"`.
 */
type ClipboardSelection = "clipboard" | "primary" | "secondary";

/**
 * Returned by `ClipboardService.write()` after copying a secret.
 * Contains everything the Phase 04 clipboard store needs to manage the timer.
 */
type ClipboardAction = {
  /** Store-relative path of the copied entry. */
  path: string;
  /** Which clipboard selection was used. */
  selection: ClipboardSelection;
  /** How many seconds until the clipboard should be cleared. */
  timerSeconds: number;
  /** Absolute timestamp (ms) when the clipboard should be cleared. */
  expiresAt: number;
};

/**
 * Reactive clipboard state for Phase 04 Pinia stores.
 * The clipboard store composes this from `ClipboardAction` and timer state.
 */
type ClipboardState = {
  /** The last clipboard write action, or null if nothing copied yet. */
  lastAction: ClipboardAction | null;
  /** Milliseconds remaining until clipboard auto-clear. 0 if inactive. */
  remainingMs: number;
  /** Whether a clipboard clear timer is currently running. */
  isActive: boolean;
};

/**
 * Index of an EntryTree for O(1) lookups.
 * Built once from the raw tree, updated on reload.
 */
type TreeIndex = {
  byPath: Map<string, EntryNode>;
  parent: Map<string, string | null>;
  children: Map<string, string[]>;
};

/**
 * A single visible row in the flattened tree renderer.
 * Derived from TreeIndex + expansion state — never stored directly.
 */
type VisibleNode = {
  path: string;
  /** Display name (extension stripped) — carried over from EntryNode. */
  name: string;
  depth: number;
  isExpanded: boolean;
  isDirectory: boolean;
};

export type {
  ClipboardAction,
  ClipboardSelection,
  ClipboardState,
  EntryDetail,
  EntryNode,
  EntryTree,
  MutationInput,
  MutationResult,
  TreeIndex,
  VisibleNode,
};
