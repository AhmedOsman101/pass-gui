import type { Icon, MessageBoxChoice } from "@neutralinojs/lib";
import { Err, Ok, type Result } from "lib-result";
import Path from "@/lib/path";
import { quoteForPosix } from "@/lib/shell";
import { Dialog } from "./dialog";
import { Fs } from "./filesystem";
import { Neu } from "./neutralino";

/**
 * Error returned by `Askpass.ensure()`. Carries the reason the sudo
 * password helper could not be offered (missing graphical session, no
 * helper installed, wrapper write failure, and so on).
 */
class AskpassError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
  }
}

/**
 * Where the resolved askpass program came from:
 * - `env`    — the user already exported `SUDO_ASKPASS` and pass-gui
 *              accepted it (known GUI helper, or accepted via the
 *              runtime dialog below); the command inherits the env
 *              var, nothing is written.
 * - `wrapper`— pass-gui wrote its own helper; the runner must inject
 *              `export SUDO_ASKPASS=...` because Neutralino's `envs`
 *              option REPLACES the child environment (no PATH, no
 *              HOME), so an env-var map cannot carry it portably.
 */
type AskpassResolution = {
  path: string;
  source: "env" | "wrapper";
};

/** Verdict on a user pre-set `SUDO_ASKPASS` value. */
type AskpassVerdict = "gui" | "terminal" | "missing" | "unknown";

/** Runtime dialog answers for unknown helpers, remembered per session. */
const SESSION_CHOICES = new Map<string, "env" | "app">();

/** Helpers that cannot prompt without a TTY (the app window has none). */
const TERMINAL_HELPERS: readonly string[] = ["whiptail", "dialog"];

/**
 * Graphical askpass programs pass-gui can vouch for: the reference
 * script's GUI branch (zenity, kdialog, yad) plus the X11 ssh-askpass
 * tools, which open their own window and need no TTY.
 */
const GUI_HELPERS: readonly string[] = [
  "zenity",
  "kdialog",
  "yad",
  "ssh-askpass",
  "x11-ssh-askpass",
];

/**
 * Graphical askpass helper **arguments**, in the conventional
 * preference order zenity → kdialog → yad (helper paths resolve to an
 * absolute binary below, so the wrapper args start at the flags).
 * TTY-based helpers (whiptail, dialog, stty) are deliberately not
 * offered: the app window has no controlling TTY.
 */
const HELPER_ARGS: Record<string, string> = {
  zenity: "--password --title='pass-gui sudo password'",
  kdialog: "--password 'pass-gui sudo password'",
  yad: "--center --entry --hide-text --title='pass-gui sudo password'",
};

const HELPER_ORDER: readonly string[] = ["zenity", "kdialog", "yad"];

const WRAPPER_HEADER = `#!/bin/sh
# SUDO_ASKPASS helper written by pass-gui. Prints the sudo password on
# stdout, the way SSH_ASKPASS programs work.`;

/**
 * Resolves a `SUDO_ASKPASS` program for in-app `sudo -A` commands.
 *
 * `sudo` inside the app window has no TTY to prompt on, so install
 * commands must run with `-A` plus this helper. Resolution order:
 * 1. A user pre-set `SUDO_ASKPASS` — honored when it is a known
 *    graphical helper, ignored when it needs a TTY (whiptail,
 *    dialog, stty, or a wrapper holding one of them) or the path is
 *    stale, and decided by a runtime dialog for anything
 *    unrecognized (the answer is remembered for this app session).
 * 2. The pass-gui wrapper (zenity → kdialog → yad, resolved to an
 *    absolute binary path). Writes the wrapper script to the user
 *    data dir and marks it executable.
 *
 * The helper zoo and the TTY-only validation mirror the
 * `get-askpass` script in https://github.com/AhmedOsman101/shellScripts.
 */
class Askpass {
  /**
   * Returns an usable askpass program path, or an `AskpassError`
   * explaining what the user can do instead (install a helper, or run
   * the command manually in a terminal).
   */
  static async ensure(): Promise<Result<AskpassResolution, AskpassError>> {
    const fromEnv = await Askpass.resolveFromEnv();
    if (fromEnv !== null) return fromEnv;

    // The helper opens a GUI password prompt — no display, no prompt,
    // no honest way to run `sudo -A` here. Checks X11 and Wayland.
    const display =
      (await Neu.getEnv("DISPLAY")) ?? (await Neu.getEnv("WAYLAND_DISPLAY"));
    if (display === "") {
      return Err(
        new AskpassError(
          "No graphical session detected, so no sudo password prompt can be offered. Copy the command and run it in a terminal."
        )
      );
    }

    // Absolute path of the first installed helper. Mounted binaries
    // may live anywhere; sudo's sanitized child PATH must not matter.
    let helper: { path: string; args: string } | null = null;
    for (const name of HELPER_ORDER) {
      const args = HELPER_ARGS[name];
      if (args === undefined) continue;

      const resolved = await Neu.resolveBinaryPath(name);
      if (resolved.isError() || resolved.ok === undefined) continue;

      helper = { path: resolved.ok, args };
      break;
    }

    if (helper === null) {
      return Err(
        new AskpassError(
          "No askpass helper found. Install zenity, kdialog or yad, or copy the command and run it in a terminal."
        )
      );
    }

    const script = `${WRAPPER_HEADER}\nexec '${helper.path}' ${helper.args}\n`;
    const wrapperPath = await Askpass.writeWrapper(script);
    if (wrapperPath.isError()) return Err(wrapperPath.error);

    return Ok({ path: wrapperPath.ok, source: "wrapper" });
  }

  /**
   * Decides on a user pre-set `SUDO_ASKPASS` without asking when the
   * helper is recognized, and with a runtime dialog when it is not.
   * Returns `null` when the env var must be ignored — unset, a
   * TTY-only helper, a stale path, a cancel, or a failed prompt — and
   * the caller falls through to the app's own GUI helper chain.
   */
  private static async resolveFromEnv(): Promise<Result<
    AskpassResolution,
    AskpassError
  > | null> {
    const existing = await Neu.getEnv("SUDO_ASKPASS");
    if (existing.length === 0) return null;

    const verdict = await Askpass.classifyExisting(existing);
    if (verdict === "gui") return Ok({ path: existing, source: "env" });
    if (verdict !== "unknown") return null;

    // The user set this helper deliberately, but pass-gui cannot tell
    // whether it can prompt without a TTY — hand the decision to them,
    // remembered per session.
    const remembered = SESSION_CHOICES.get(existing);
    if (remembered === "env") return Ok({ path: existing, source: "env" });
    if (remembered === "app") return null;

    const choice = await Dialog.showMessageBox(
      "Sudo password helper",
      `SUDO_ASKPASS is set to:\n${existing}\n\npass-gui cannot tell whether that helper can open a password prompt inside the app (without a terminal).\n\nOK — use your helper.\nCancel — use the helper pass-gui sets up instead.`,
      "OK_CANCEL" as MessageBoxChoice,
      "QUESTION" as Icon
    );
    if (choice.isError()) return null;

    const useEnv = choice.ok === "OK";
    SESSION_CHOICES.set(existing, useEnv ? "env" : "app");
    return useEnv ? Ok({ path: existing, source: "env" }) : null;
  }

  /**
   * Classifies a pre-set `SUDO_ASKPASS`: real executables are matched
   * by base name, generated wrapper scripts (often a file named
   * `askpass` holding one helper invocation) by sniffing their
   * content. Comparing both shapes keeps a TTY-only helper from
   * hiding behind a wrapper.
   */
  private static async classifyExisting(
    existing: string
  ): Promise<AskpassVerdict> {
    const base = (existing.split("/").pop() ?? "").toLowerCase();
    if (TERMINAL_HELPERS.includes(base)) return "terminal";
    if (GUI_HELPERS.includes(base)) return "gui";
    if (!existing.startsWith("/")) return "unknown";

    const read = await Fs.readFile(existing);
    if (read.isError()) return "missing";

    const head = read.ok.slice(0, 2000).toLowerCase();
    if (
      head.includes("whiptail") ||
      head.includes("dialog") ||
      head.includes("stty")
    ) {
      return "terminal";
    }
    if (GUI_HELPERS.some(helper => head.includes(helper))) return "gui";
    return "unknown";
  }

  /**
   * Writes (and chmods) the askpass wrapper into the user cache dir.
   * Rewriting on every call keeps the wrapper in sync with the helper.
   */
  private static async writeWrapper(
    script: string
  ): Promise<Result<string, AskpassError>> {
    const cacheDir = await Path.getKnownPath("cache");
    if (cacheDir.isError()) {
      return Err(new AskpassError(cacheDir.error.message, cacheDir.error));
    }

    const appDir = await Fs.join(cacheDir.ok, "pass-gui");
    if (appDir.isError()) {
      return Err(new AskpassError(appDir.error.message, appDir.error));
    }

    const mkdir = await Fs.mkdir(appDir.ok);
    if (mkdir.isError()) {
      return Err(new AskpassError(mkdir.error.message, mkdir.error));
    }

    const wrapperPath = await Fs.join(appDir.ok, "askpass");
    if (wrapperPath.isError()) {
      return Err(
        new AskpassError(wrapperPath.error.message, wrapperPath.error)
      );
    }

    const write = await Fs.writeFile(wrapperPath.ok, script);
    if (write.isError()) {
      return Err(new AskpassError(write.error.message, write.error));
    }

    const chmod = await Fs.chmod(wrapperPath.ok, 0o700);
    if (chmod.isError()) {
      return Err(new AskpassError(chmod.error.message, chmod.error));
    }
    if (!chmod.ok.success) {
      return Err(
        new AskpassError(
          chmod.ok.message ??
            `Failed to change permissions on ${wrapperPath.ok}.`
        )
      );
    }

    return Ok(wrapperPath.ok);
  }
}

/**
 * Builds the `sh -c` payload for a guide command: injects the
 * SUDO_ASKPASS export via `quoteForPosix` when the app provided the
 * wrapper itself; a pre-existing env var needs no injection.
 */
function runPayload(command: string, resolution: AskpassResolution): string {
  if (resolution.source === "env") return command;
  return `export SUDO_ASKPASS=${quoteForPosix(resolution.path)}; ${command}`;
}

export { Askpass, AskpassError, type AskpassResolution, runPayload };
