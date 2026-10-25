import type { OperatingSystem } from "@neutralinojs/lib";
import type { DistroFamily } from "@/types/guide";

/**
 * Pure distro detection for Guides — same data-in/data-out discipline
 * as `lib/step-machine.ts`.
 *
 * The caller does the file I/O (`Filesystem.readFile("/etc/os-release")`)
 * and hands in the file's **text** plus the OS. Parsing uses `ID` first,
 * then each `ID_LIKE` token as fallback. No shell, no binary probing:
 * helper preferences (nala/paru/yay) surface as Guide alternatives, and
 * PRETTY_NAME is read separately for display.
 */
const ID_FAMILIES: Record<string, DistroFamily> = {
  // Debian / Ubuntu family
  debian: "apt",
  ubuntu: "apt",
  linuxmint: "apt",
  pop: "apt",
  raspbian: "apt",
  kali: "apt",
  neon: "apt",
  elementary: "apt",
  // Fedora / RHEL family (modern dnf systems)
  fedora: "dnf",
  rhel: "dnf",
  almalinux: "dnf",
  rocky: "dnf",
  ol: "dnf",
  // centos and amzn resolve through the legacy branches below.
  // SUSE family
  opensuse: "zypper",
  "opensuse-leap": "zypper",
  "opensuse-tumbleweed": "zypper",
  sled: "zypper",
  sles: "zypper",
  // Arch family
  arch: "pacman",
  manjaro: "pacman",
  endeavouros: "pacman",
  archcraft: "pacman",
  cachyos: "pacman",
  // Others
  void: "xbps",
  alpine: "apk",
  gentoo: "emerge",
  funtoo: "emerge",
};

/**
 * `ID_LIKE` substrings in the source script's fallback order:
 * debian/ubuntu → apt, fedora/rhel → dnf, suse → zypper, arch → pacman.
 */
const LIKE_FAMILIES = [
  { needle: "debian", family: "apt" },
  { needle: "ubuntu", family: "apt" },
  { needle: "fedora", family: "dnf" },
  { needle: "rhel", family: "dnf" },
  { needle: "suse", family: "zypper" },
  { needle: "arch", family: "pacman" },
] as const;

type OsRelease = {
  id: string;
  idLike: string[];
  versionId: string | null;
  prettyName: string | null;
};

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

/** Parses the `KEY=value` lines of an os-release file. */
function parseOsRelease(text: string): OsRelease {
  const values = new Map<string, string>();

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = unquote(trimmed.slice(separator + 1).trim());
    values.set(key, value);
  }

  return {
    id: (values.get("ID") ?? "").toLowerCase(),
    idLike: (values.get("ID_LIKE") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
    versionId: values.get("VERSION_ID") ?? null,
    prettyName: values.get("PRETTY_NAME") ?? null,
  };
}

/**
 * Resolves the package-manager family for the current OS.
 *
 * `osReleaseText` may be `null` when the file could not be read —
 * such systems render the docs-link fallback Guide. macOS maps to
 * Homebrew without touching the file. Legacy rpm branches match the
 * source script: CentOS 7 and Amazon Linux 2 use yum, newer releases
 * use dnf.
 *
 * Parsing rules (`ID`, `ID_LIKE`, legacy `VERSION_ID` branches) are a
 * faithful port of the `get-package-manager` script in
 * https://github.com/AhmedOsman101/shellScripts — keeping them in
 * sync matters when that script changes.
 */
function detectDistroFamily(
  os: OperatingSystem,
  osReleaseText: string | null
): DistroFamily {
  if (os === "Darwin") return "brew";
  if (os !== "Linux" || osReleaseText === null) return "unknown";

  const { id, idLike, versionId } = parseOsRelease(osReleaseText);

  if (id === "centos") {
    return versionId?.startsWith("7") ? "yum" : "dnf";
  }
  if (id === "amzn") {
    return versionId === "2" ? "yum" : "dnf";
  }

  const byId = ID_FAMILIES[id];
  if (byId) return byId;

  // `opensuse*` glob from the script: covers distro IDs like
  // "opensuse-microos" without an explicit table row.
  if (id.startsWith("opensuse")) return "zypper";

  for (const token of idLike) {
    const match = LIKE_FAMILIES.find(entry => token.includes(entry.needle));
    if (match) return match.family;
  }

  return "unknown";
}

/**
 * Reads `PRETTY_NAME` from os-release text for display. Returns
 * `null` when the value is absent.
 */
function prettyNameFrom(osReleaseText: string): string | null {
  return parseOsRelease(osReleaseText).prettyName;
}

export { detectDistroFamily, prettyNameFrom };
