import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Version } from "@/types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function compareVersions(current: Version, target: Version): number {
  if (current.major !== target.major) return current.major - target.major;
  if (current.minor !== target.minor) return current.minor - target.minor;
  return current.patch - target.patch;
}

export { cn, compareVersions };
