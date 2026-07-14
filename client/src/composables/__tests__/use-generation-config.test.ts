import { Err, Ok } from "lib-result";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/config", () => ({
  Config: { getValue: vi.fn() },
}));

import { Config } from "@/services/config";
import { useGenerationConfig } from "../use-generation-config";

const DEFAULTS = {
  memorable: false,
  length: 25,
  symbols: true,
} as const;

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

describe("useGenerationConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes options from DEFAULT_CONFIG", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Err(new Error("no config")));
    const { options } = useGenerationConfig();
    expect(options.memorable).toBe(DEFAULTS.memorable);
    expect(options.length).toBe(DEFAULTS.length);
    expect(options.symbols).toBe(DEFAULTS.symbols);
    await tick();
    expect(options.memorable).toBe(DEFAULTS.memorable);
    expect(options.length).toBe(DEFAULTS.length);
    expect(options.symbols).toBe(DEFAULTS.symbols);
  });

  it("overrides all options when all Config.getValue calls succeed", async () => {
    vi.mocked(Config.getValue)
      .mockResolvedValueOnce(Ok(true))
      .mockResolvedValueOnce(Ok(40))
      .mockResolvedValueOnce(Ok(false));
    const { options } = useGenerationConfig();
    await tick();
    expect(options.memorable).toBe(true);
    expect(options.length).toBe(40);
    expect(options.symbols).toBe(false);
  });

  it("partially overrides when some calls fail", async () => {
    vi.mocked(Config.getValue)
      .mockResolvedValueOnce(Ok(true))
      .mockResolvedValueOnce(Err(new Error("no config")))
      .mockResolvedValueOnce(Ok(false));
    const { options } = useGenerationConfig();
    await tick();
    expect(options.memorable).toBe(true);
    expect(options.length).toBe(DEFAULTS.length);
    expect(options.symbols).toBe(false);
  });

  it("overrides memorable and length but keeps symbols default", async () => {
    vi.mocked(Config.getValue)
      .mockResolvedValueOnce(Ok(true))
      .mockResolvedValueOnce(Ok(20))
      .mockResolvedValueOnce(Err(new Error("no config")));
    const { options } = useGenerationConfig();
    await tick();
    expect(options.memorable).toBe(true);
    expect(options.length).toBe(20);
    expect(options.symbols).toBe(DEFAULTS.symbols);
  });

  it("preserves defaults when all calls fail", async () => {
    vi.mocked(Config.getValue).mockResolvedValue(Err(new Error("no config")));
    const { options } = useGenerationConfig();
    await tick();
    expect(options.memorable).toBe(DEFAULTS.memorable);
    expect(options.length).toBe(DEFAULTS.length);
    expect(options.symbols).toBe(DEFAULTS.symbols);
  });

  it("overrides length with a numeric value", async () => {
    vi.mocked(Config.getValue)
      .mockResolvedValueOnce(Err(new Error("no config")))
      .mockResolvedValueOnce(Ok(64))
      .mockResolvedValueOnce(Err(new Error("no config")));
    const { options } = useGenerationConfig();
    await tick();
    expect(options.length).toBe(64);
    expect(typeof options.length).toBe("number");
  });

  it("overrides memorable with a boolean value", async () => {
    vi.mocked(Config.getValue)
      .mockResolvedValueOnce(Ok(true))
      .mockResolvedValueOnce(Err(new Error("no config")))
      .mockResolvedValueOnce(Err(new Error("no config")));
    const { options } = useGenerationConfig();
    await tick();
    expect(options.memorable).toBe(true);
    expect(typeof options.memorable).toBe("boolean");
  });

  it("overrides symbols with a boolean value", async () => {
    vi.mocked(Config.getValue)
      .mockResolvedValueOnce(Err(new Error("no config")))
      .mockResolvedValueOnce(Err(new Error("no config")))
      .mockResolvedValueOnce(Ok(false));
    const { options } = useGenerationConfig();
    await tick();
    expect(options.symbols).toBe(false);
    expect(typeof options.symbols).toBe("boolean");
  });
});
