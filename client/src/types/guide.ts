import type { Version } from "@/types";

// Omitting a type-alias for the OS on purpose: `OperatingSystem` from
// `@neutralinojs/lib` (Neutralino's `NL_OS` value set) is reused
// verbatim so `Neu.OS` passes untyped at call sites.

/**
 * Package-manager family a Guide can target. Detected from
 * `/etc/os-release` on Linux (via `lib/distro.ts`) or straight from
 * the OS on macOS. `"unknown"` means no install command is known —
 * the Guide falls back to the official docs link.
 */
type DistroFamily =
  | "apt"
  | "dnf"
  | "yum"
  | "zypper"
  | "pacman"
  | "xbps"
  | "apk"
  | "emerge"
  | "brew"
  | "unknown";

/** Required binaries that can carry a Guide. */
type BinaryKey = "pass" | "gpg" | "tree";

/** Whether a Guide installs the binary or upgrades an outdated one. */
type GuideVariant = "install" | "upgrade";

/**
 * One blocking binary issue mapped to its Guide inputs: which binary,
 * install vs upgrade variant, and the found/expected versions carried
 * by version-codes. Missing-checkout codes yield the install variant
 * with no version info to show.
 */
type BinaryIssueEntry = {
  binary: BinaryKey;
  variant: GuideVariant;
  found: Version | null;
  expected: Version | null;
};

/**
 * One selectable command in a Guide's chip row: the exact command to
 * copy/run, the package-manager family it belongs to (its note travels
 * with it), and — implicit — its display label (first non-sudo token).
 */
type GuideCandidate = {
  command: string;
  family: DistroFamily;
  note: string | null;
};

/**
 * Everything one Guide renders for a binary on a system: the
 * selectable command chips (index 0 = detected default), the
 * official-docs link, and prose for renders with no command at all
 * (Windows docs-only fallback).
 */
type BinaryGuide = {
  binary: BinaryKey;
  label: string;
  family: DistroFamily;
  variant: GuideVariant;
  candidates: GuideCandidate[];
  docsUrl: string;
  fallbackNote: string | null;
};

export type {
  BinaryGuide,
  BinaryIssueEntry,
  BinaryKey,
  DistroFamily,
  GuideCandidate,
  GuideVariant,
};
