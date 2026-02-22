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

export { cn, compareVersions };
