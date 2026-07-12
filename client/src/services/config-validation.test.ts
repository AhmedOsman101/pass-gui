import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_CONFIG } from "@/lib/constants";
import {
  formatZodError,
  validateAppConfig,
  validateClipboardConfig,
  validateCoreConfig,
  validateExtensionsConfig,
  validateGenerationConfig,
  validateGpgConfig,
  validatePreferencesConfig,
  validateStoresConfig,
} from "./config-validation";

describe("validateAppConfig", () => {
  it("accepts valid DEFAULT_CONFIG", () => {
    const result = validateAppConfig(DEFAULT_CONFIG);
    expect(result.isOk()).toBe(true);
  });

  it("rejects missing active_store", () => {
    const result = validateAppConfig({ ...DEFAULT_CONFIG, core: {} });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i => i.path.includes("active_store"))
    ).toBe(true);
  });

  it("rejects empty active_store", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      core: { active_store: "" },
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i => i.path.includes("active_store"))
    ).toBe(true);
  });

  it("rejects active_store referencing undefined store", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      core: { active_store: "nonexistent" },
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(
        i =>
          i.path.join(".") === "core.active_store" &&
          i.message.includes("nonexistent")
      )
    ).toBe(true);
  });

  it("rejects empty stores object", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      stores: {},
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i =>
        i.message.includes("At least one store")
      )
    ).toBe(true);
  });

  it("rejects non-number default_length", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      generation: {
        ...DEFAULT_CONFIG.generation,
        default_length: "abc" as unknown as number,
      },
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i => i.path.includes("default_length"))
    ).toBe(true);
  });

  it("rejects default_length less than 8", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      generation: { ...DEFAULT_CONFIG.generation, default_length: 5 },
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i => i.path.includes("default_length"))
    ).toBe(true);
  });

  it("rejects default_length greater than 128", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      generation: { ...DEFAULT_CONFIG.generation, default_length: 200 },
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i => i.path.includes("default_length"))
    ).toBe(true);
  });

  it("rejects negative clear_after_seconds", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      clipboard: { ...DEFAULT_CONFIG.clipboard, clear_after_seconds: -1 },
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i => i.path.includes("clear_after_seconds"))
    ).toBe(true);
  });

  it("rejects invalid selection enum value", () => {
    const result = validateAppConfig({
      ...DEFAULT_CONFIG,
      clipboard: {
        ...DEFAULT_CONFIG.clipboard,
        selection: "invalid" as "clipboard",
      },
    });
    expect(result.isError()).toBe(true);
    expect(
      result.error!.issues.some(i => i.path.includes("selection"))
    ).toBe(true);
  });
});

describe("individual section validators", () => {
  describe("validateCoreConfig", () => {
    it("accepts valid core config", () => {
      const result = validateCoreConfig({ active_store: "test" });
      expect(result.isOk()).toBe(true);
    });

    it("rejects missing active_store", () => {
      const result = validateCoreConfig({});
      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(z.ZodError);
    });
  });

  describe("validateGenerationConfig", () => {
    it("accepts valid generation config", () => {
      const result = validateGenerationConfig(DEFAULT_CONFIG.generation);
      expect(result.isOk()).toBe(true);
    });

    it("rejects missing required field", () => {
      const result = validateGenerationConfig({
        default_length: 25,
        symbols: true,
        character_set: "a",
        character_set_no_symbols: "a",
      });
      expect(result.isError()).toBe(true);
      expect(
        result.error!.issues.some(i => i.path.includes("memorable"))
      ).toBe(true);
    });
  });

  describe("validateClipboardConfig", () => {
    it("accepts valid clipboard config", () => {
      const result = validateClipboardConfig(DEFAULT_CONFIG.clipboard);
      expect(result.isOk()).toBe(true);
    });

    it("rejects invalid selection", () => {
      const result = validateClipboardConfig({
        ...DEFAULT_CONFIG.clipboard,
        selection: "invalid" as "clipboard",
      });
      expect(result.isError()).toBe(true);
      expect(
        result.error!.issues.some(i => i.path.includes("selection"))
      ).toBe(true);
    });
  });

  describe("validateGpgConfig", () => {
    it("accepts valid gpg config", () => {
      const result = validateGpgConfig(DEFAULT_CONFIG.gpg);
      expect(result.isOk()).toBe(true);
    });
  });

  describe("validateExtensionsConfig", () => {
    it("accepts valid extensions config", () => {
      const result = validateExtensionsConfig(DEFAULT_CONFIG.extensions);
      expect(result.isOk()).toBe(true);
    });
  });

  describe("validatePreferencesConfig", () => {
    it("accepts empty object and rejects extra keys (strict)", () => {
      const okResult = validatePreferencesConfig({});
      expect(okResult.isOk()).toBe(true);

      const errResult = validatePreferencesConfig({ extraKey: "value" });
      expect(errResult.isError()).toBe(true);
    });
  });

  describe("validateStoresConfig", () => {
    it("accepts valid stores", () => {
      const result = validateStoresConfig(DEFAULT_CONFIG.stores);
      expect(result.isOk()).toBe(true);
    });

    it("rejects store with empty path", () => {
      const result = validateStoresConfig({ bad: { path: "" } });
      expect(result.isError()).toBe(true);
      expect(
        result.error!.issues.some(i => i.path.includes("path"))
      ).toBe(true);
    });
  });
});

describe("formatZodError", () => {
  it("formats single issue with path", () => {
    const result = validateCoreConfig({});
    const formatted = formatZodError(result.error!);
    expect(formatted).toMatch(/^active_store: /);
    expect(formatted).toMatch(/Invalid input/);
  });

  it("formats multiple issues with newline separation", () => {
    const result = validateAppConfig({});
    const formatted = formatZodError(result.error!);
    const lines = formatted.split("\n");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("formats issue without path", () => {
    const result = validateCoreConfig(123 as unknown as Record<string, unknown>);
    const formatted = formatZodError(result.error!);
    expect(formatted).toBe(
      "Invalid input: expected object, received number"
    );
  });
});
