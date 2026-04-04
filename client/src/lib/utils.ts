import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Brand, Version } from "@/types";

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
 * Creates or preserves branded types for type-safe distinct types.
 *
 * This function has three overloads:
 *
 * **Case 1 - Preserve existing Brand type:**
 * Pass a type parameter that is already a branded type to preserve its brand.
 *
 * **Case 2 - Construct new Brand with explicit type parameters:**
 * Pass a value and specify the brand tag via type parameters.
 *
 * **Case 3 - Construct Brand with phantom witness:**
 * Pass a phantom type as the first argument to create a new branded type.
 *
 * @template TBrand - The brand identifier (e.g., "userId", "uuid")
 * @template T - The underlying type (e.g., string, number)
 * @param brandOrValue - Either the brand witness (Case 3) or the value itself (Case 1, 2)
 * @param value - The value to brand (Case 3 only, omit for Case 1, 2)
 * @returns The value as a branded type
 *
 * @example
 * // Case 1: Preserve existing Brand type
 * type UserId = Brand<number, "userId">;
 * const userId = brand<UserId>(5); // Returns UserId
 *
 * @example
 * // Case 2: Explicit type parameters (brand as type argument, value as argument)
 * const uuid = brand<"uuid", string>("f929df1d-8d44-41a2-9e35-30d54b1730b2");
 *
 * @example
 * // Case 3: Create Brand using phantom witness
 * const uuid = brand(phantom<"uuid">(), as<string>("f929df1d-8d44-41a2-9e35-30d54b1730b2"));
 */
// Case 1: TBrand is already a Brand<T, X> — preserve it
function brand<TBrand extends Brand<unknown, unknown>>(value: TBrand): TBrand;
// Case 2: explicit tag + type, single argument
function brand<TBrand, T>(value: T): Brand<T, TBrand>;
// Case 3: raw tag witness + value — construct Brand<T, TBrand>
function brand<TBrand, T>(_brand: TBrand, value: T): Brand<T, TBrand>;
// Implementation
function brand(brandOrValue: unknown, value?: unknown): unknown {
  return value ?? brandOrValue;
}

export { cn, compareVersions, brand };
