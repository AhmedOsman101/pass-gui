// Config service unit tests — P4 Core Service Tests Task 1
vi.mock("@/services/filesystem", () => ({
  Fs: {
    join: vi.fn((...p: string[]) => Promise.resolve(p.join("/"))),
    exists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    isDirectory: vi.fn(),
    getPathParts: vi.fn(),
  },
}));

vi.mock("@/lib/path", () => ({
  default: {
    getKnownPath: vi.fn(),
    resolveUserPath: vi.fn(),
  },
}));

vi.mock("@/lib/toml", () => ({
  default: {
    parse: vi.fn(),
    stringify: vi.fn(),
    buildDefaultConfigTable: vi.fn(),
  },
}));

vi.mock("@/services/watcher", () => ({
  Watcher: {
    watch: vi.fn(),
    hasChanged: vi.fn(),
    invalidate: vi.fn(),
  },
}));

import { Err, Ok } from "lib-result";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/constants";
import {
  ConfigParseError,
  ConfigValidationError,
  ConfigWriteError,
} from "@/lib/errors";
import Path from "@/lib/path";
import toml from "@/lib/toml";
import { Fs } from "@/services/filesystem";
import { Watcher } from "@/services/watcher";
import type { AppConfig } from "@/types/config";
import type { ParsedToml } from "@/types/toml";
import { Config } from "../config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { TomlObject, TomlStringified } from "@/types/toml";

function makeMockParsedToml(
  overrides?: Partial<AppConfig>
): ParsedToml<AppConfig> {
  const hasStoresOverride = overrides && "stores" in overrides;
  const data = {
    ...DEFAULT_CONFIG,
    ...overrides,
    core: { ...DEFAULT_CONFIG.core, ...overrides?.core },
    stores: hasStoresOverride
      ? overrides!.stores
      : { ...DEFAULT_CONFIG.stores },
  } as unknown as TomlObject<AppConfig>;
  return {
    data,
    _raw: {
      core: {},
      preferences: {},
      generation: {},
      clipboard: {},
      gpg: {},
      extensions: {},
      stores: {},
    } as unknown as ReturnType<typeof import("@ltd/j-toml")["parse"]>,
  } as ParsedToml<AppConfig>;
}

const CONFIG_PATH = "/home/user/.config/pass-gui/config.toml";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Reset internal cache
  (
    Config as unknown as { _cachedResult: ParsedToml<AppConfig> | null }
  )._cachedResult = null;

  // Default mock returns
  vi.mocked(Path.getKnownPath).mockResolvedValue(Ok("/home/user/.config"));
  vi.mocked(Fs.exists).mockResolvedValue(Ok(true));
  vi.mocked(Fs.readFile).mockResolvedValue(Ok("content"));
  vi.mocked(Fs.writeFile).mockResolvedValue(Ok(true));
  vi.mocked(Fs.mkdir).mockResolvedValue(Ok(true));
  vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(true));
  vi.mocked(Fs.getPathParts).mockResolvedValue(
    Ok({
      rootName: "",
      rootDirectory: "/",
      rootPath: "/",
      relativePath: "pass-gui/config.toml",
      parentPath: "/home/user/.config/pass-gui",
      filename: "config.toml",
      stem: "config",
      extension: ".toml",
    })
  );
  vi.mocked(toml.parse).mockReturnValue(Ok(makeMockParsedToml()));
  vi.mocked(toml.stringify).mockReturnValue(
    Ok("serialized content" as unknown as TomlStringified<unknown>)
  );
  vi.mocked(toml.buildDefaultConfigTable).mockReturnValue({} as never);
  vi.mocked(Watcher.watch).mockResolvedValue(Ok(undefined));
  vi.mocked(Watcher.hasChanged).mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// getPath / exists
// ===========================================================================

describe("Config.getPath", () => {
  it("returns resolved config path on success", async () => {
    const result = await Config.getPath();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(CONFIG_PATH);
    expect(Path.getKnownPath).toHaveBeenCalledWith("config");
  });

  it("returns error when Path.getKnownPath fails", async () => {
    const testErr = new Error("known path error");
    vi.mocked(Path.getKnownPath).mockResolvedValue(Err(testErr));

    const result = await Config.getPath();

    expect(result.isError()).toBe(true);
    expect(result.error).toBe(testErr);
  });
});

describe("Config.exists", () => {
  it("returns true when file exists", async () => {
    vi.mocked(Fs.exists).mockResolvedValue(Ok(true));

    const result = await Config.exists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(true);
    expect(Fs.exists).toHaveBeenCalledWith(CONFIG_PATH);
  });

  it("returns false when file does not exist", async () => {
    vi.mocked(Fs.exists).mockResolvedValue(Ok(false));

    const result = await Config.exists();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("propagates error from Config.getPath", async () => {
    const testErr = new Error("getPath error");
    vi.mocked(Path.getKnownPath).mockResolvedValue(Err(testErr));

    const result = await Config.exists();

    expect(result.isError()).toBe(true);
    expect(result.error).toBe(testErr);
  });
});

// ===========================================================================
// load — cache behavior
// ===========================================================================

describe("Config.load — cache behavior", () => {
  it("passes through ensure error", async () => {
    vi.spyOn(Config, "ensure").mockResolvedValue(
      Err(new Error("ensure failed"))
    );

    const result = await Config.load();

    expect(result.isError()).toBe(true);
    expect(result.error!.message).toBe("ensure failed");
  });

  it("returns cached result when watcher reports no change", async () => {
    // First call populates cache
    const firstResult = await Config.load();
    expect(firstResult.isOk()).toBe(true);
    expect(Fs.readFile).toHaveBeenCalledTimes(1);

    // Second call uses cache
    vi.mocked(Fs.readFile).mockClear();
    const secondResult = await Config.load();

    expect(secondResult.isOk()).toBe(true);
    expect(Fs.readFile).not.toHaveBeenCalled();
    expect(secondResult.ok).toBe(firstResult.ok);
  });

  it("re-reads from disk when watcher reports change", async () => {
    // First call populates cache
    const firstResult = await Config.load();
    expect(firstResult.isOk()).toBe(true);
    expect(Fs.readFile).toHaveBeenCalledTimes(1);

    // Second call with changed flag — reads again
    vi.mocked(Watcher.hasChanged).mockReturnValue(true);
    vi.mocked(Fs.readFile).mockClear();
    const secondResult = await Config.load();

    expect(secondResult.isOk()).toBe(true);
    expect(Fs.readFile).toHaveBeenCalledTimes(1);
  });

  it("re-reads from disk on first call (no cache)", async () => {
    const result = await Config.load();

    expect(result.isOk()).toBe(true);
    expect(Fs.readFile).toHaveBeenCalledTimes(1);
  });

  it("lazy-inits watcher with correct dir path", async () => {
    await Config.load();

    expect(Watcher.watch).toHaveBeenCalledWith(
      "config",
      "/home/user/.config/pass-gui",
      "config.toml"
    );
  });
});

// ===========================================================================
// load — error paths
// ===========================================================================

describe("Config.load — error paths", () => {
  it("propagates Fs.readFile error", async () => {
    vi.mocked(Fs.readFile).mockResolvedValue(Err(new Error("read failed")));

    const result = await Config.load();

    expect(result.isError()).toBe(true);
    expect(result.error!.message).toBe("read failed");
  });

  it("wraps toml.parse error with ConfigParseError", async () => {
    vi.mocked(toml.parse).mockReturnValue(Err(new Error("invalid toml")));

    const result = await Config.load();

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ConfigParseError);
    expect((result.error as ConfigParseError).code).toBe("CONFIG_PARSE_ERROR");
  });

  it("wraps validateAppConfig error with ConfigValidationError", async () => {
    // Config with empty stores (no default store) fails cross-field validation
    const invalidData = makeMockParsedToml({
      stores: {} as Record<string, never>,
    } as unknown as Partial<AppConfig>);
    vi.mocked(toml.parse).mockReturnValue(Ok(invalidData));

    const result = await Config.load();

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ConfigValidationError);
    expect((result.error as ConfigValidationError).code).toBe(
      "CONFIG_VALIDATION_ERROR"
    );
  });
});

// ===========================================================================
// save
// ===========================================================================

describe("Config.save", () => {
  const validParsed = makeMockParsedToml();

  it("writes config successfully and invalidates cache", async () => {
    const result = await Config.save(validParsed);

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBeUndefined();
    expect(Fs.writeFile).toHaveBeenCalledWith(
      CONFIG_PATH,
      "serialized content"
    );
    expect(Watcher.invalidate).toHaveBeenCalledWith("config");
  });

  it("rejects invalid config with ConfigValidationError", async () => {
    const invalidData = makeMockParsedToml({
      stores: {} as Record<string, never>,
    } as unknown as Partial<AppConfig>);

    const result = await Config.save(invalidData);

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ConfigValidationError);
    expect((result.error as ConfigValidationError).code).toBe(
      "CONFIG_VALIDATION_ERROR"
    );
  });

  it("returns ConfigWriteError when Fs.writeFile fails", async () => {
    vi.mocked(Fs.writeFile).mockResolvedValue(Err(new Error("write failed")));

    const result = await Config.save(validParsed);

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ConfigWriteError);
    expect((result.error as ConfigWriteError).code).toBe("CONFIG_WRITE_ERROR");
    expect((result.error as ConfigWriteError).path).toBe(CONFIG_PATH);
  });

  it("returns error when toml.stringify fails", async () => {
    vi.mocked(toml.stringify).mockReturnValue(
      Err(new Error("stringify failed"))
    );

    const result = await Config.save(validParsed);

    expect(result.isError()).toBe(true);
    expect(result.error!.message).toBe("stringify failed");
  });
});

// ===========================================================================
// ensure
// ===========================================================================

describe("Config.ensure", () => {
  it("creates default config when file does not exist", async () => {
    vi.mocked(Fs.exists).mockResolvedValue(Ok(false));

    const result = await Config.ensure();

    expect(result.isOk()).toBe(true);
    expect(toml.buildDefaultConfigTable).toHaveBeenCalledWith(DEFAULT_CONFIG);
    expect(toml.stringify).toHaveBeenCalled();
    expect(Fs.writeFile).toHaveBeenCalledWith(
      CONFIG_PATH,
      "serialized content"
    );
  });

  it("skips creation when config already exists", async () => {
    vi.mocked(Fs.exists).mockResolvedValue(Ok(true));

    const result = await Config.ensure();

    expect(result.isOk()).toBe(true);
    expect(Fs.mkdir).not.toHaveBeenCalled();
    expect(Fs.writeFile).not.toHaveBeenCalled();
  });

  it("creates directory when parent does not exist", async () => {
    vi.mocked(Fs.exists).mockResolvedValue(Ok(false));
    vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(false));

    const result = await Config.ensure();

    expect(result.isOk()).toBe(true);
    expect(Fs.mkdir).toHaveBeenCalledWith("/home/user/.config/pass-gui");
  });

  it("propagates mkdir failure", async () => {
    vi.mocked(Fs.exists).mockResolvedValue(Ok(false));
    vi.mocked(Fs.isDirectory).mockResolvedValue(Ok(false));
    vi.mocked(Fs.mkdir).mockResolvedValue(Err(new Error("mkdir failed")));

    const result = await Config.ensure();

    expect(result.isError()).toBe(true);
    expect(result.error!.message).toBe("mkdir failed");
  });

  it("propagates write failure with ConfigWriteError", async () => {
    vi.mocked(Fs.exists).mockResolvedValue(Ok(false));
    vi.mocked(Fs.writeFile).mockResolvedValue(Err(new Error("write failed")));

    const result = await Config.ensure();

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ConfigWriteError);
    expect((result.error as ConfigWriteError).code).toBe("CONFIG_WRITE_ERROR");
  });
});

// ===========================================================================
// getValue
// ===========================================================================

describe("Config.getValue", () => {
  it("returns value from loaded config", async () => {
    const result = await Config.getValue("core", "active_store");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("default");
  });

  it("falls back to DEFAULT_CONFIG value when key is missing in loaded config", async () => {
    // Return a loaded config where gpg section is missing
    const fallbackParsed = makeMockParsedToml();
    delete (fallbackParsed.data as Record<string, unknown>).gpg;
    vi.spyOn(Config, "load").mockResolvedValue(Ok(fallbackParsed));

    const result = await Config.getValue("gpg", "opts");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toEqual([]);
  });

  it("returns error when Config.load fails", async () => {
    vi.spyOn(Config, "load").mockResolvedValue(Err(new Error("load failed")));

    const result = await Config.getValue("core", "active_store");

    expect(result.isError()).toBe(true);
    expect(result.error!.message).toBe("load failed");
  });

  it("returns undefined for optional key not present in loaded or default config", async () => {
    const result = await Config.getValue("gpg", "signing_key");

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBeUndefined();
  });
});

// ===========================================================================
// setValue
// ===========================================================================

describe("Config.setValue", () => {
  it("modifies config and saves", async () => {
    const result = await Config.setValue("core", "active_store", "default");

    expect(result.isOk()).toBe(true);
    expect(Fs.writeFile).toHaveBeenCalled();
  });

  it("returns error when Config.load fails", async () => {
    vi.spyOn(Config, "load").mockResolvedValue(Err(new Error("load failed")));

    const result = await Config.setValue("core", "active_store", "default");

    expect(result.isError()).toBe(true);
    expect(result.error!.message).toBe("load failed");
  });

  it("returns error when Config.save fails", async () => {
    vi.mocked(toml.stringify).mockReturnValue(
      Err(new Error("stringify failed"))
    );

    const result = await Config.setValue("core", "active_store", "default");

    expect(result.isError()).toBe(true);
    expect(result.error!.message).toBe("stringify failed");
  });
});

// ===========================================================================
// edge cases
// ===========================================================================

describe("edge cases", () => {
  it("works with a mock ParsedToml object", () => {
    const parsed = makeMockParsedToml({
      core: { active_store: "custom" },
    });

    expect(parsed.data.core.active_store).toBe("custom");
    expect(parsed.data.generation.default_length).toBe(25);
    expect(parsed._raw).toBeDefined();
  });

  it("has no cached result after instantiation", () => {
    expect(
      (
        Config as unknown as {
          _cachedResult: ParsedToml<AppConfig> | null;
        }
      )._cachedResult
    ).toBeNull();
  });

  it("second call to Config.load uses cache", async () => {
    await Config.load();
    vi.mocked(Fs.readFile).mockClear();

    await Config.load();

    expect(Fs.readFile).not.toHaveBeenCalled();
  });
});
