import { OperatingSystem } from "@neutralinojs/lib";
import type { Version } from "@/types";
import type {
  BinaryGuide,
  BinaryIssueEntry,
  BinaryKey,
  DistroFamily,
  GuideCandidate,
  GuideVariant,
} from "@/types/guide";
import type { ReadinessIssue } from "@/types/readiness";

/**
 * The Guides feature: per-platform install/upgrade instructions for a
 * missing or outdated required binary (glossary "Guide"). Started as a
 * pure lib table and grew into feature behavior — candidate
 * composition, issue mapping, display copy — so it lives here as a
 * service. The distro *parsing* it consumes stays pure in
 * `lib/distro.ts`.
 *
 * No I/O, no state: the service is a typed, static content oracle that
 * components render; the chip selection lives in `BinaryGuide.vue`.
 *
 * Commands are the execution-ready shapes: `sudo -A` (password via
 * `SUDO_ASKPASS`, which the app resolves itself when it runs a
 * command — fallback chain: zenity → kdialog → * yad),
 * yum without sudo on legacy rpm systems, `--noconfirm` on
 * pacman so a non-interactive run cannot hang on a prompt.
 */
type FamilyCommands = {
  install: string;
  upgrade: string;
  alternatives?: readonly string[];
  note?: string;
};

type BinaryGuideSource = {
  label: string;
  docsUrl: string;
  families: Partial<Record<DistroFamily, FamilyCommands>>;
};

type FamilyLabel = Record<DistroFamily, string>;

const FAMILY_LABELS: FamilyLabel = {
  apt: "Debian / Ubuntu (apt)",
  dnf: "Fedora / RHEL (dnf)",
  yum: "Legacy rpm (yum)",
  zypper: "openSUSE / SUSE (zypper)",
  pacman: "Arch Linux (pacman)",
  xbps: "Void Linux (xbps)",
  apk: "Alpine Linux (apk)",
  emerge: "Gentoo (emerge)",
  brew: "macOS (Homebrew)",
  unknown: "Unknown distribution",
};

/** URL fallbacks shown by every Guide, also as the docs-only variant. */
const DOC_URLS: Record<BinaryKey, string> = {
  pass: "https://www.passwordstore.org/",
  gpg: "https://gnupg.org/download/",
  tree: "http://mama.indstate.edu/users/ice/tree/",
};

const SOURCES: Record<BinaryKey, BinaryGuideSource> = {
  pass: {
    label: "pass",
    docsUrl: DOC_URLS.pass,
    families: {
      apt: {
        install: "sudo -A apt install pass",
        upgrade:
          "sudo -A apt update && sudo -A apt install --only-upgrade pass",
        alternatives: ["sudo -A nala install pass"],
      },
      dnf: {
        install: "sudo -A dnf install pass",
        upgrade: "sudo -A dnf upgrade pass",
        note: "On CentOS 7 or Amazon Linux 2, use yum instead.",
      },
      yum: {
        install: "yum install pass",
        upgrade: "yum update pass",
        note: "CentOS 7 and Amazon Linux 2 run yum without sudo.",
      },
      zypper: {
        install: "sudo -A zypper install password-store",
        upgrade: "sudo -A zypper update password-store",
      },
      pacman: {
        install: "sudo -A pacman -S --noconfirm pass",
        upgrade: "sudo -A pacman -Syu --noconfirm pass",
        alternatives: ["paru -S pass", "yay -S pass"],
        note: "You can also install pass through an AUR helper.",
      },
      xbps: {
        install: "sudo -A xbps-install -S pass",
        upgrade: "sudo -A xbps-install -Su pass",
      },
      apk: {
        install: "sudo -A apk add pass",
        upgrade: "sudo -A apk upgrade pass",
      },
      emerge: {
        install: "sudo -A emerge app-admin/pass",
        upgrade: "sudo -A emerge --update app-admin/pass",
      },
      brew: {
        install: "brew install pass",
        upgrade: "brew upgrade pass",
      },
    },
  },
  gpg: {
    label: "GnuPG (gpg)",
    docsUrl: DOC_URLS.gpg,
    families: {
      apt: {
        install: "sudo -A apt install gnupg",
        upgrade:
          "sudo -A apt update && sudo -A apt install --only-upgrade gnupg",
      },
      dnf: {
        install: "sudo -A dnf install gnupg2",
        upgrade: "sudo -A dnf upgrade gnupg2",
        note: "On CentOS 7 or Amazon Linux 2, use yum instead.",
      },
      yum: {
        install: "yum install gnupg2",
        upgrade: "yum update gnupg2",
        note: "CentOS 7 and Amazon Linux 2 run yum without sudo.",
      },
      zypper: {
        install: "sudo -A zypper install gpg2",
        upgrade: "sudo -A zypper update gpg2",
      },
      pacman: {
        install: "sudo -A pacman -S --noconfirm gnupg",
        upgrade: "sudo -A pacman -Syu --noconfirm gnupg",
        alternatives: ["paru -S gnupg", "yay -S gnupg"],
        note: "You can also install gnupg through an AUR helper.",
      },
      xbps: {
        install: "sudo -A xbps-install -S gnupg",
        upgrade: "sudo -A xbps-install -Su gnupg",
      },
      apk: {
        install: "sudo -A apk add gnupg",
        upgrade: "sudo -A apk upgrade gnupg",
      },
      emerge: {
        install: "sudo -A emerge app-crypt/gnupg",
        upgrade: "sudo -A emerge --update app-crypt/gnupg",
      },
      brew: {
        install: "brew install gnupg",
        upgrade: "brew upgrade gnupg",
      },
    },
  },
  tree: {
    label: "tree",
    docsUrl: DOC_URLS.tree,
    families: {
      apt: {
        install: "sudo -A apt install tree",
        upgrade:
          "sudo -A apt update && sudo -A apt install --only-upgrade tree",
      },
      dnf: {
        install: "sudo -A dnf install tree",
        upgrade: "sudo -A dnf upgrade tree",
        note: "On CentOS 7 or Amazon Linux 2, use yum instead.",
      },
      yum: {
        install: "yum install tree",
        upgrade: "yum update tree",
        note: "CentOS 7 and Amazon Linux 2 run yum without sudo.",
      },
      zypper: {
        install: "sudo -A zypper install tree",
        upgrade: "sudo -A zypper update tree",
      },
      pacman: {
        install: "sudo -A pacman -S --noconfirm tree",
        upgrade: "sudo -A pacman -Syu --noconfirm tree",
        alternatives: ["paru -S tree", "yay -S tree"],
        note: "You can also install tree through an AUR helper.",
      },
      xbps: {
        install: "sudo -A xbps-install -S tree",
        upgrade: "sudo -A xbps-install -Su tree",
      },
      apk: {
        install: "sudo -A apk add tree",
        upgrade: "sudo -A apk upgrade tree",
      },
      emerge: {
        install: "sudo -A emerge app-misc/tree",
        upgrade: "sudo -A emerge --update app-misc/tree",
      },
      brew: {
        install: "brew install tree",
        upgrade: "brew upgrade tree",
      },
    },
  },
};

const NO_COMMAND_NOTE =
  "Automatic installation is not supported on Windows yet. Use the official docs below to install it.";

/**
 * Homebrew is a valid package manager on Linux too (user decision);
 * the Unknown-distro chip list and Linux-family alternatives lean on
 * that.
 */
const UNKNOWN_FAMILY_ORDER: readonly DistroFamily[] = [
  "brew",
  "apt",
  "pacman",
  "dnf",
  "xbps",
  "apk",
  "yum",
  "zypper",
  "emerge",
] as const;

/**
 * A service over the static Guide content.
 */
class Guides {
  /**
   * Builds the selectable command chips for one binary/variant on one
   * system, in stable preference order.
   *
   * - Detected family first (helper preferences nala/paru/yay next —
   *   install variants only, per the note they carry), then Homebrew
   *   for Linux families.
   * - UNKNOWN (or a Linux/Unix without a usable os-release): Homebrew
   *   first as the portable primary, then every family.
   * - Windows: no chips at all — docs-only render.
   */
  static candidates(
    source: BinaryGuideSource,
    family: DistroFamily,
    variant: GuideVariant,
    os: OperatingSystem
  ): GuideCandidate[] {
    const detected = source.families[family];
    const chips: GuideCandidate[] = [];

    if (detected) {
      chips.push({
        command: detected[variant],
        family,
        note: detected.note ?? null,
      });

      if (os !== "Windows") {
        if (variant === "install" && detected.alternatives) {
          for (const alternative of detected.alternatives) {
            chips.push({ command: alternative, family, note: null });
          }
        }
        const brewCommand = source.families.brew?.[variant];
        if (brewCommand && family !== "brew") {
          chips.push({ command: brewCommand, family: "brew", note: null });
        }
      }

      return chips;
    }

    if (family === "unknown" && os !== "Windows") {
      for (const candidateFamily of UNKNOWN_FAMILY_ORDER) {
        const commands = source.families[candidateFamily];
        if (!commands) continue;
        chips.push({
          command: commands[variant],
          family: candidateFamily,
          note: commands.note ?? null,
        });
      }
    }

    return chips;
  }

  /**
   * Resolves the display Guide for one binary on one system. Pure
   * lookup over the static table; an empty chip list renders
   * docs-only (Windows fallback).
   */
  static forBinary(
    binary: BinaryKey,
    family: DistroFamily,
    variant: GuideVariant,
    os: OperatingSystem = OperatingSystem.Linux
  ): BinaryGuide {
    const source = SOURCES[binary];

    return {
      binary,
      label: source.label,
      family,
      variant,
      candidates: Guides.candidates(source, family, variant, os),
      docsUrl: source.docsUrl,
      fallbackNote: NO_COMMAND_NOTE,
    };
  }

  /**
   * Maps blocking readiness issues to Guide inputs — one entry per
   * issue, so a snapshot with several binary codes renders several
   * Guide sections. Unknown codes are ignored on purpose: the
   * binaries step never claims to interpret what it cannot map.
   *
   * The detection chain short-circuits at the first failed check, so
   * a snapshot currently carries at most one binary issue — the list
   * mapping keeps several sections possible.
   */
  static issueEntries(issues: readonly ReadinessIssue[]): BinaryIssueEntry[] {
    const entries: BinaryIssueEntry[] = [];

    for (const issue of issues) {
      switch (issue.code) {
        case "PASS_BINARY_MISSING":
          entries.push({
            binary: "pass",
            variant: "install",
            found: null,
            expected: null,
          });
          break;
        case "PASS_VERSION_TOO_OLD":
          entries.push({
            binary: "pass",
            variant: "upgrade",
            found: issue.found,
            expected: issue.expected,
          });
          break;
        case "GPG_BINARY_MISSING":
          entries.push({
            binary: "gpg",
            variant: "install",
            found: null,
            expected: null,
          });
          break;
        case "GPG_VERSION_TOO_OLD":
          entries.push({
            binary: "gpg",
            variant: "upgrade",
            found: issue.found,
            expected: issue.expected,
          });
          break;
        case "TREE_BINARY_MISSING":
          entries.push({
            binary: "tree",
            variant: "install",
            found: null,
            expected: null,
          });
          break;
      }
    }

    return entries;
  }

  /** Display name of a distro family for the step header. */
  static familyLabel(family: DistroFamily): string {
    return FAMILY_LABELS[family];
  }

  /**
   * Display label for one command chip: the first token that isn't
   * sudo plumbing — "apt", "paru", "yum", "brew", "xbps-install",
   * whatever heads the command. Computed, never stored, so table
   * edits can't desync the labels.
   */
  static chipLabel(command: string): string {
    for (const token of command.split(/\s+/)) {
      if (token === "sudo" || token === "-A") continue;
      return token;
    }
    return command;
  }

  /** Renders a Version as "1.7.0" / "2.1". */
  static versionLabel(version: Version): string {
    return version.patch === undefined
      ? `${version.major}.${version.minor}`
      : `${version.major}.${version.minor}.${version.patch}`;
  }
}

export { Guides };
