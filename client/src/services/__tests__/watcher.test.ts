import { events, filesystem } from "@neutralinojs/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Watcher } from "../watcher";

describe("Watcher", () => {
  beforeEach(async () => {
    await Watcher.unwatchAll().catch(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    (Watcher as any).watchers?.clear();
  });

  describe("watch", () => {
    it("creates watcher and registers event handler", async () => {
      const result = await Watcher.watch(
        "store:default",
        "/store",
        "config.toml"
      );
      expect(result.isOk()).toBe(true);
      expect(vi.mocked(filesystem.createWatcher)).toHaveBeenCalledWith(
        "/store"
      );
      expect(vi.mocked(events.on)).toHaveBeenCalledWith(
        "watchFile",
        expect.any(Function)
      );
    });

    it("returns Ok for duplicate watcher id (no-op)", async () => {
      const result1 = await Watcher.watch("dup", "/dir", "f.txt");
      expect(result1.isOk()).toBe(true);
      vi.mocked(filesystem.createWatcher).mockClear();

      const result2 = await Watcher.watch("dup", "/other", "g.txt");
      expect(result2.isOk()).toBe(true);
      expect(vi.mocked(filesystem.createWatcher)).not.toHaveBeenCalled();
    });

    it("returns error when createWatcher throws", async () => {
      vi.mocked(filesystem.createWatcher).mockRejectedValueOnce(
        new Error("fail")
      );
      const result = await Watcher.watch("err", "/dir", "f.txt");
      expect(result.isError()).toBe(true);
    });

    it("returns error when events.on throws", async () => {
      vi.mocked(events.on).mockRejectedValueOnce(new Error("fail"));
      const result = await Watcher.watch("err2", "/dir", "f.txt");
      expect(result.isError()).toBe(true);
    });
  });

  describe("event handling", () => {
    it("sets changed flag when matching event fires", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      const handler = vi.mocked(events.on).mock.calls[0]![1] as (
        ev: CustomEvent
      ) => void;
      handler({
        detail: { id: 42, filename: "file.gpg" },
      } as CustomEvent);
      expect(Watcher.hasChanged("test")).toBe(true);
    });

    it("ignores non-matching events", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      const handler = vi.mocked(events.on).mock.calls[0]![1] as (
        ev: CustomEvent
      ) => void;
      handler({
        detail: { id: 42, filename: "other.gpg" },
      } as CustomEvent);
      expect(Watcher.hasChanged("test")).toBe(false);
    });

    it("ignores events with non-matching watcher id", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      const handler = vi.mocked(events.on).mock.calls[0]![1] as (
        ev: CustomEvent
      ) => void;
      handler({
        detail: { id: 999, filename: "file.gpg" },
      } as CustomEvent);
      expect(Watcher.hasChanged("test")).toBe(false);
    });
  });

  describe("hasChanged", () => {
    it("returns true then resets", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      const handler = vi.mocked(events.on).mock.calls[0]![1] as (
        ev: CustomEvent
      ) => void;
      handler({
        detail: { id: 42, filename: "file.gpg" },
      } as CustomEvent);
      expect(Watcher.hasChanged("test")).toBe(true);
      expect(Watcher.hasChanged("test")).toBe(false);
    });

    it("returns false when no change", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      expect(Watcher.hasChanged("test")).toBe(false);
    });

    it("returns false for unknown watcher id", () => {
      expect(Watcher.hasChanged("nonexistent")).toBe(false);
    });
  });

  describe("invalidate", () => {
    it("forces changed flag to true", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      Watcher.invalidate("test");
      expect(Watcher.hasChanged("test")).toBe(true);
    });
  });

  describe("unwatch", () => {
    it("removes watcher and cleans up", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      const handler = vi.mocked(events.on).mock.calls[0]![1];
      const result = await Watcher.unwatch("test");
      expect(result.isOk()).toBe(true);
      expect(vi.mocked(events.off)).toHaveBeenCalledWith("watchFile", handler);
      expect(vi.mocked(filesystem.removeWatcher)).toHaveBeenCalledWith(42);
    });

    it("returns Ok for already-unwatched id", async () => {
      const result = await Watcher.unwatch("nonexistent");
      expect(result.isOk()).toBe(true);
    });

    it("returns error when events.off throws", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      vi.mocked(events.off).mockRejectedValueOnce(new Error("fail"));
      const result = await Watcher.unwatch("test");
      expect(result.isError()).toBe(true);
    });

    it("still calls removeWatcher when events.off throws (no native leak)", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      vi.mocked(events.off).mockRejectedValueOnce(new Error("fail"));
      await Watcher.unwatch("test");
      expect(vi.mocked(filesystem.removeWatcher)).toHaveBeenCalledWith(42);
    });

    it("returns error when removeWatcher throws", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      vi.mocked(filesystem.removeWatcher).mockRejectedValueOnce(
        new Error("fail")
      );
      const result = await Watcher.unwatch("test");
      expect(result.isError()).toBe(true);
    });

    it("removes entry from map on cleanup failure so retries do not happen", async () => {
      await Watcher.watch("test", "/dir", "file.gpg");
      vi.mocked(filesystem.removeWatcher).mockRejectedValueOnce(
        new Error("fail")
      );
      await Watcher.unwatch("test");
      // A second call should be a no-op (entry already gone), not a retry.
      vi.mocked(filesystem.removeWatcher).mockClear();
      const result2 = await Watcher.unwatch("test");
      expect(result2.isOk()).toBe(true);
      expect(vi.mocked(filesystem.removeWatcher)).not.toHaveBeenCalled();
    });
  });

  describe("unwatchAll", () => {
    it("removes all watchers", async () => {
      await Watcher.watch("a", "/d1", "f1.gpg");
      await Watcher.watch("b", "/d2", "f2.gpg");
      await Watcher.watch("c", "/d3", "f3.gpg");
      const result = await Watcher.unwatchAll();
      expect(result.isOk()).toBe(true);
      expect(vi.mocked(events.off)).toHaveBeenCalledTimes(3);
    });

    it("returns Ok when no watchers exist", async () => {
      const result = await Watcher.unwatchAll();
      expect(result.isOk()).toBe(true);
    });

    it("continues draining remaining watchers after a failure", async () => {
      await Watcher.watch("a", "/d1", "f1.gpg");
      await Watcher.watch("b", "/d2", "f2.gpg");
      await Watcher.watch("c", "/d3", "f3.gpg");
      vi.mocked(filesystem.removeWatcher).mockImplementation(id =>
        id === 42 ? Promise.reject(new Error("fail")) : Promise.resolve(42)
      );
      const result = await Watcher.unwatchAll();
      expect(result.isError()).toBe(true);
      // All three should have been attempted, not just the first.
      expect(vi.mocked(filesystem.removeWatcher)).toHaveBeenCalledTimes(3);
    });
  });
});
