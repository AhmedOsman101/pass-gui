import { clipboard as neuClipboard } from "@neutralinojs/lib";
import { ErrFromText, Ok, type Result } from "lib-result";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClipboardError } from "@/lib/errors";
import { Config } from "@/services/config";
import type { AppConfig } from "@/types/config";
import type { ClipboardAction } from "@/types/entries";
import type { ParsedToml } from "@/types/toml";
import { Clipboard } from "../clipboard";

vi.mock("@/services/config", () => ({
  Config: {
    load: vi.fn(() => Promise.resolve(ErrFromText("not found"))),
    getValue: vi.fn(),
    setValue: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Clipboard.writeText", () => {
  it("returns clipboard action with timer on success", async () => {
    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: {
          clipboard: { clear_after_seconds: 30, selection: "clipboard" },
        },
        _raw: {},
      }) as unknown as Result<ParsedToml<AppConfig>>
    );

    const before = Date.now();
    const result = await Clipboard.writeText("s3cret", "Email/work");

    expect(result.isOk()).toBe(true);
    const action = result.ok as ClipboardAction;
    expect(action.path).toBe("Email/work");
    expect(action.selection).toBe("clipboard");
    expect(action.timerSeconds).toBe(30);
    expect(action.expiresAt).toBeGreaterThanOrEqual(before + 30 * 1000 - 100);
    expect(action.expiresAt).toBeLessThanOrEqual(before + 30 * 1000 + 100);
  });

  it("defaults selection to 'clipboard' when config doesn't specify", async () => {
    vi.mocked(Config.load).mockResolvedValue(
      Ok({ data: {}, _raw: {} }) as unknown as Result<ParsedToml<AppConfig>>
    );

    const result = await Clipboard.writeText("s3cret", "Email/work");

    expect(result.isOk()).toBe(true);
    expect(result.ok!.selection).toBe("clipboard");
  });

  it("defaults clear_after_seconds to 45 when config doesn't specify", async () => {
    vi.mocked(Config.load).mockResolvedValue(
      Ok({ data: {}, _raw: {} }) as unknown as Result<ParsedToml<AppConfig>>
    );

    const result = await Clipboard.writeText("s3cret", "Email/work");

    expect(result.isOk()).toBe(true);
    expect(result.ok!.timerSeconds).toBe(45);
  });

  it("uses custom selection from config", async () => {
    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: { clipboard: { clear_after_seconds: 45, selection: "primary" } },
        _raw: {},
      }) as unknown as Result<ParsedToml<AppConfig>>
    );

    const result = await Clipboard.writeText("s3cret", "Email/work");

    expect(result.isOk()).toBe(true);
    expect(result.ok!.selection).toBe("primary");
  });

  it("returns error when Config.load fails", async () => {
    vi.mocked(Config.load).mockResolvedValue(ErrFromText("config error"));

    const result = await Clipboard.writeText("s3cret", "Email/work");

    expect(result.isError()).toBe(true);
    expect(result.error!).toBeInstanceOf(ClipboardError);
    expect((result.error! as ClipboardError).selection).toBe("clipboard");
    expect(result.error!.message).toContain("config error");
  });

  it("returns error when neuClipboard.writeText throws", async () => {
    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: {
          clipboard: { clear_after_seconds: 45, selection: "clipboard" },
        },
        _raw: {},
      }) as unknown as Result<ParsedToml<AppConfig>>
    );
    vi.mocked(neuClipboard.writeText).mockRejectedValue(
      new Error("write failed")
    );

    const result = await Clipboard.writeText("s3cret", "Email/work");

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ClipboardError);
  });

  it("writes the secret to the clipboard", async () => {
    vi.mocked(Config.load).mockResolvedValue(
      Ok({
        data: {
          clipboard: { clear_after_seconds: 45, selection: "clipboard" },
        },
        _raw: {},
      }) as unknown as Result<ParsedToml<AppConfig>>
    );

    await Clipboard.writeText("s3cret", "Email/work");

    expect(neuClipboard.writeText).toHaveBeenCalledWith("s3cret");
  });
});

describe("Clipboard.readText", () => {
  it("returns clipboard content", async () => {
    vi.mocked(neuClipboard.readText).mockResolvedValue("password123");

    const result = await Clipboard.readText();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("password123");
  });

  it("returns empty string when clipboard is empty", async () => {
    vi.mocked(neuClipboard.readText).mockResolvedValue("");

    const result = await Clipboard.readText();

    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("");
  });

  it("returns error when neuClipboard.readText throws", async () => {
    vi.mocked(neuClipboard.readText).mockRejectedValue(
      new Error("read failed")
    );

    const result = await Clipboard.readText();

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ClipboardError);
  });
});

describe("Clipboard.clear", () => {
  it("returns Ok on success", async () => {
    vi.mocked(neuClipboard.clear).mockResolvedValue(undefined);

    const result = await Clipboard.clear();

    expect(result.isOk()).toBe(true);
  });

  it("returns error when neuClipboard.clear throws", async () => {
    vi.mocked(neuClipboard.clear).mockRejectedValue(new Error("clear failed"));

    const result = await Clipboard.clear();

    expect(result.isError()).toBe(true);
    expect(result.error).toBeInstanceOf(ClipboardError);
  });
});
