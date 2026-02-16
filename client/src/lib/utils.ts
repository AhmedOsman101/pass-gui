import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Stringifiable, Version } from "@/types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function escapeShellArg(arg: Stringifiable): string {
  const strArg = String(arg);

  // Simple quoting for Unix/Windows; real implementation would be more complex
  return `"${strArg.replace(/"/g, '\\"')}"`;
}

export { cn, compareVersions, escapeShellArg };
