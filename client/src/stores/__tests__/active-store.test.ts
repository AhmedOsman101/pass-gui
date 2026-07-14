import { createTestingPinia } from "@pinia/testing";
import { Err, Ok } from "lib-result";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/config", () => ({
  Config: { getValue: vi.fn(), load: vi.fn(), setValue: vi.fn() },
}));

vi.mock("@/services/pass", () => ({
  Pass: { setStorePath: vi.fn(), storeDirectory: "" },
}));

vi.mock("@/lib/path", () => ({
  default: { resolveUserPath: vi.fn() },
}));

import Path from "@/lib/path";
import { Config } from "@/services/config";
import { Pass } from "@/services/pass";
import { useActiveStoreStore } from "@/stores/active-store";

const resolvedPath = "/home/user/.password-store/work";

const configPayload: any = {
  data: {
    core: { active_store: "work" },
    preferences: {},
    generation: {
      memorable: false,
      default_length: 25,
      symbols: true,
      character_set: "",
      character_set_no_symbols: "",
    },
    clipboard: { clear_after_seconds: 45, selection: "clipboard" },
    gpg: { opts: [] },
    extensions: { enabled: false },
    stores: {
      work: {
        path: "~/.password-store/work",
        gnupg_home: "/home/user/.gnupg-work",
      },
      personal: { path: "~/.password-store/personal" },
    },
  },
  _raw: {} as never,
};

describe("active-store store", () => {
  beforeEach(() => {
    createTestingPinia({ stubActions: false, createSpy: vi.fn });
    vi.clearAllMocks();
  });

  it("has null/empty initial state", () => {
    const store = useActiveStoreStore();
    expect(store.storePath).toBeNull();
    expect(store.storeName).toBeNull();
    expect(store.isValidating).toBe(false);
    expect(store.error).toBeNull();
    expect(store.hasStore).toBe(false);
  });

  it("load() sets isValidating true then false on success", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Ok("work"));
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));
    vi.mocked(Path.resolveUserPath).mockResolvedValue(Ok(resolvedPath));

    const store = useActiveStoreStore();
    const promise = store.load();
    expect(store.isValidating).toBe(true);
    await promise;
    expect(store.isValidating).toBe(false);
  });

  it("load() success resolves name, resolves path, sets store state", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Ok("work"));
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));
    vi.mocked(Path.resolveUserPath).mockResolvedValue(Ok(resolvedPath));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.storeName).toBe("work");
    expect(store.storePath).toBe(resolvedPath);
    expect(store.error).toBeNull();
    expect(store.hasStore).toBe(true);
    expect(Pass.setStorePath).toHaveBeenCalledWith(resolvedPath);
  });

  it("load() with Config.getValue error sets error", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(
      Err(new Error("config not found"))
    );
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toBe("Failed to read active store: config not found");
    expect(store.storeName).toBeNull();
    expect(store.storePath).toBeNull();
    expect(store.hasStore).toBe(false);
  });

  it("load() with Config.load error sets error", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Ok("work"));
    vi.mocked(Config.load).mockResolvedValue(Err(new Error("parse error")));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toBe("Failed to load config: parse error");
    expect(store.storePath).toBeNull();
  });

  it("load() with store not found in config sets error", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Ok("nonexistent"));
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toBe('Store "nonexistent" not found in config');
    expect(store.storePath).toBeNull();
  });

  it("load() with path resolution error sets error", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Ok("work"));
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));
    vi.mocked(Path.resolveUserPath).mockResolvedValue(
      Err(new Error("bad path"))
    );

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toBe("Failed to resolve store path: bad path");
    expect(store.storePath).toBeNull();
    expect(store.hasStore).toBe(false);
  });

  it("load() exception handling sets error from Error object", async () => {
    vi.mocked(Config.getValue).mockRejectedValue(new Error("unexpected crash"));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toBe("unexpected crash");
    expect(store.isValidating).toBe(false);
  });

  it("load() exception handling sets error from non-Error throw", async () => {
    vi.mocked(Config.getValue).mockRejectedValue("string error");

    const store = useActiveStoreStore();
    await store.load();

    expect(store.error).toBe("string error");
    expect(store.isValidating).toBe(false);
  });

  it("switchTo() success resolves name, resolves path, sets store state", async () => {
    vi.mocked(Config.setValue).mockResolvedValue(Ok(undefined));
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));
    vi.mocked(Path.resolveUserPath).mockResolvedValue(Ok(resolvedPath));

    const store = useActiveStoreStore();
    await store.switchTo("work");

    expect(store.storeName).toBe("work");
    expect(store.storePath).toBe(resolvedPath);
    expect(store.error).toBeNull();
    expect(store.hasStore).toBe(true);
    expect(Pass.setStorePath).toHaveBeenCalledWith(resolvedPath);
    expect(Config.setValue).toHaveBeenCalledWith(
      "core",
      "active_store",
      "work"
    );
  });

  it("switchTo() with Config.setValue error sets error", async () => {
    vi.mocked(Config.setValue).mockResolvedValue(
      Err(new Error("permission denied"))
    );

    const store = useActiveStoreStore();
    await store.switchTo("work");

    expect(store.error).toBe("Failed to switch store: permission denied");
    expect(store.storeName).toBeNull();
    expect(store.storePath).toBeNull();
  });

  it("switchTo() with Config.load error sets error", async () => {
    vi.mocked(Config.setValue).mockResolvedValue(Ok(undefined));
    vi.mocked(Config.load).mockResolvedValue(Err(new Error("reload failed")));

    const store = useActiveStoreStore();
    await store.switchTo("work");

    expect(store.error).toBe("Failed to reload config: reload failed");
    expect(store.storePath).toBeNull();
  });

  it("switchTo() with store not found sets error", async () => {
    vi.mocked(Config.setValue).mockResolvedValue(Ok(undefined));
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));

    const store = useActiveStoreStore();
    await store.switchTo("nonexistent");

    expect(store.error).toBe('Store "nonexistent" not found in config');
    expect(store.storePath).toBeNull();
  });

  it("getGpgHome returns gnupg_home from currentStoreConfig", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Ok("work"));
    vi.mocked(Config.load).mockResolvedValue(Ok(configPayload));
    vi.mocked(Path.resolveUserPath).mockResolvedValue(Ok(resolvedPath));

    const store = useActiveStoreStore();
    await store.load();

    expect(store.getGpgHome()).toBe("/home/user/.gnupg-work");
  });

  it("getGpgHome returns undefined when no currentStoreConfig", () => {
    const store = useActiveStoreStore();
    expect(store.getGpgHome()).toBeUndefined();
  });
});
