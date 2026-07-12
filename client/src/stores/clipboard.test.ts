import { createTestingPinia } from "@pinia/testing";
import { Err, Ok } from "lib-result";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/clipboard", () => ({
  Clipboard: { writeText: vi.fn(), clear: vi.fn() },
}));

import { ClipboardError } from "@/lib/errors";
import { Clipboard } from "@/services/clipboard";
import { useClipboardStore } from "@/stores/clipboard";
import type { ClipboardAction } from "@/types/entries";

describe("clipboard store", () => {
  beforeEach(() => {
    createTestingPinia({ stubActions: false, createSpy: vi.fn });
    vi.useFakeTimers({ now: 0 });
    vi.clearAllMocks();
    vi.mocked(Clipboard.clear).mockResolvedValue(Ok(undefined));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has null/empty initial state", () => {
    const store = useClipboardStore();
    expect(store.lastAction).toBeNull();
    expect(store.remainingMs).toBe(0);
    expect(store.isCopied).toBe(false);
    expect(store.error).toBeNull();
    expect(store.isActive).toBe(false);
    expect(store.formattedRemaining).toBe("0s");
  });

  it("copy() sets state on success", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    const store = useClipboardStore();
    await store.copy("secret", "x");
    expect(store.lastAction).toEqual({
      path: "x",
      selection: "clipboard",
      timerSeconds: 30,
      expiresAt: 30_000,
    });
    expect(store.isCopied).toBe(true);
    expect(store.remainingMs).toBe(30_000);
    expect(store.error).toBeNull();
  });

  it("copy() returns ClipboardAction on success", async () => {
    const action: ClipboardAction = {
      path: "x",
      selection: "clipboard",
      timerSeconds: 30,
      expiresAt: 30_000,
    };
    vi.mocked(Clipboard.writeText).mockResolvedValue(Ok(action));
    const store = useClipboardStore();
    const result = await store.copy("secret", "x");
    expect(result).toEqual(action);
  });

  it("copy() timer decrements remainingMs on tick", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    const store = useClipboardStore();
    await store.copy("secret", "x");
    expect(store.remainingMs).toBe(30_000);
    vi.advanceTimersByTime(1_000);
    expect(store.remainingMs).toBe(29_000);
    vi.advanceTimersByTime(5_000);
    expect(store.remainingMs).toBe(24_000);
  });

  it("copy() error sets error and returns null", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Err(new ClipboardError("clipboard", "write failed"))
    );
    const store = useClipboardStore();
    const result = await store.copy("secret", "x");
    expect(result).toBeNull();
    expect(store.error).toBe("Clipboard write failed: write failed");
    expect(store.isCopied).toBe(false);
  });

  it("clear() resets state after copy", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    const store = useClipboardStore();
    await store.copy("secret", "x");
    expect(store.isCopied).toBe(true);
    await store.clear();
    expect(store.isCopied).toBe(false);
    expect(store.lastAction).toBeNull();
    expect(store.remainingMs).toBe(0);
    expect(store.error).toBeNull();
    expect(Clipboard.clear).toHaveBeenCalled();
  });

  it("clear() error still resets state", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    vi.mocked(Clipboard.clear).mockResolvedValue(
      Err(new ClipboardError("clipboard", "clear failed"))
    );
    const store = useClipboardStore();
    await store.copy("secret", "x");
    expect(store.isCopied).toBe(true);
    await store.clear();
    expect(store.error).toBe("Clipboard clear failed: clear failed");
    expect(store.isCopied).toBe(false);
    expect(store.lastAction).toBeNull();
    expect(store.remainingMs).toBe(0);
  });

  it("clears clipboard on timer expiry", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    const store = useClipboardStore();
    await store.copy("secret", "x");
    expect(store.isCopied).toBe(true);
    expect(Clipboard.clear).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(Clipboard.clear).toHaveBeenCalled();
    expect(store.isCopied).toBe(false);
    expect(store.remainingMs).toBe(0);
  });

  it("clear() stops timer before expiry", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    const store = useClipboardStore();
    await store.copy("secret", "x");
    expect(store.isCopied).toBe(true);
    expect(store.remainingMs).toBe(30_000);
    vi.advanceTimersByTime(5_000);
    expect(store.remainingMs).toBe(25_000);
    await store.clear();
    expect(Clipboard.clear).toHaveBeenCalledTimes(1);
    expect(store.isCopied).toBe(false);
    expect(store.remainingMs).toBe(0);
    vi.advanceTimersByTime(30_000);
    expect(Clipboard.clear).toHaveBeenCalledTimes(1);
  });

  it("isActive is true only when copied and timer running", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    const store = useClipboardStore();
    expect(store.isActive).toBe(false);
    await store.copy("secret", "x");
    expect(store.isActive).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(store.isActive).toBe(false);
  });

  it("formattedRemaining shows seconds", async () => {
    vi.mocked(Clipboard.writeText).mockResolvedValue(
      Ok({
        path: "x",
        selection: "clipboard",
        timerSeconds: 30,
        expiresAt: 30_000,
      })
    );
    const store = useClipboardStore();
    expect(store.formattedRemaining).toBe("0s");
    await store.copy("secret", "x");
    expect(store.formattedRemaining).toBe("30s");
    vi.advanceTimersByTime(5_000);
    expect(store.formattedRemaining).toBe("25s");
  });

  it("second copy restarts timer", async () => {
    vi.mocked(Clipboard.writeText)
      .mockResolvedValueOnce(
        Ok({
          path: "a",
          selection: "clipboard",
          timerSeconds: 30,
          expiresAt: 30_000,
        })
      )
      .mockResolvedValueOnce(
        Ok({
          path: "b",
          selection: "clipboard",
          timerSeconds: 10,
          expiresAt: 40_000,
        })
      );
    const store = useClipboardStore();
    await store.copy("secret1", "a");
    expect(store.lastAction?.path).toBe("a");
    expect(store.remainingMs).toBe(30_000);
    vi.advanceTimersByTime(5_000);
    expect(store.remainingMs).toBe(25_000);
    await store.copy("secret2", "b");
    expect(store.lastAction?.path).toBe("b");
    expect(store.remainingMs).toBe(35_000);
    await vi.advanceTimersByTimeAsync(35_000);
    expect(Clipboard.clear).toHaveBeenCalled();
    expect(store.isCopied).toBe(false);
  });
});
