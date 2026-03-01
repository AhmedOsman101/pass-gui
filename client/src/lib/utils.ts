import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Version } from "@/types";

/**
 * Combines class names with Tailwind CSS class merging.
 * Uses clsx for conditional classes and twMerge to dedupe Tailwind classes.
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compares two semantic versions.
 * Returns negative if current < target, positive if current > target, 0 if equal.
 * Compares major, then minor, then patch versions.
 */
function compareVersions(current: Version, target: Version): number {
  if (current.major !== target.major) return current.major - target.major;
  if (current.minor !== target.minor) return current.minor - target.minor;
  return current.patch - target.patch;
}

/**
 * Expands the tilde (~) character at the start of a path to the user's home directory.
 *
 * @param path - The file path that may start with a tilde character
 * @param homeDir - The absolute path to the user's home directory
 * @returns The expanded path with the tilde replaced by the home directory path,
 *          or the original path if it doesn't start with a tilde
 *
 * @example
 * expandTilde("~/documents/file.txt", "/home/user") // Returns "/home/user/documents/file.txt"
 * expandTilde("~/", "/home/user") // Returns "/home/user/"
 * expandTilde("/absolute/path", "/home/user") // Returns "/absolute/path"
 */
function expandTilde(path: string, homeDir: string): string {
  return path.replace(/^~(?=[/\\]|$)/, homeDir);
}

export { cn, compareVersions, expandTilde };
