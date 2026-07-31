import { createTestingPinia } from "@pinia/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/readiness", () => ({
  Readiness: { check: vi.fn() },
}));

import { Readiness } from "@/services/readiness";
import { useReadinessStore } from "@/stores/readiness";
import type { ReadinessSnapshot } from "@/types/readiness";

const readySnapshot: ReadinessSnapshot = {
  state: "READY",
  issues: [],
  evaluatedAt: Date.now(),
};

const blockedSnapshot: ReadinessSnapshot = {
  state: "NEED_PASS",
  issues: [
    { code: "PASS_BINARY_MISSING", severity: "blocking" },
    { code: "STORE_NO_ENTRIES", severity: "info", path: "/tmp/test" },
  ],
  evaluatedAt: Date.now(),
};

const emptySnapshot: ReadinessSnapshot = {
  state: "STORE_EMPTY",
  issues: [{ code: "STORE_NO_ENTRIES", severity: "info", path: "/tmp/test" }],
  evaluatedAt: Date.now(),
};

describe("readiness store", () => {
  beforeEach(() => {
    createTestingPinia({ stubActions: false, createSpy: vi.fn });
  });

  it("has null/empty initial state", () => {
    const store = useReadinessStore();
    expect(store.snapshot).toBeNull();
    expect(store.isEvaluating).toBe(false);
    expect(store.error).toBeNull();
    expect(store.state).toBe("NEED_PASS");
    expect(store.isReady).toBe(false);
    expect(store.blockingIssues).toEqual([]);
    expect(store.infoIssues).toEqual([]);
  });

  it("evaluate() success with READY state", async () => {
    vi.mocked(Readiness.check).mockResolvedValue(readySnapshot);
    const store = useReadinessStore();
    await store.evaluate("/tmp/store");
    expect(store.snapshot).toEqual(readySnapshot);
    expect(store.state).toBe("READY");
    expect(store.isReady).toBe(true);
    expect(store.isEvaluating).toBe(false);
    expect(store.error).toBeNull();
  });

  it("evaluate() success with NEED_PASS and blocking issues", async () => {
    vi.mocked(Readiness.check).mockResolvedValue(blockedSnapshot);
    const store = useReadinessStore();
    await store.evaluate("/tmp/store");
    expect(store.state).toBe("NEED_PASS");
    expect(store.isReady).toBe(false);
    expect(store.blockingIssues).toHaveLength(1);
    expect(store.blockingIssues[0]?.code).toBe("PASS_BINARY_MISSING");
    expect(store.infoIssues).toHaveLength(1);
    expect(store.infoIssues[0]?.code).toBe("STORE_NO_ENTRIES");
  });

  it("evaluate() error with Error object", async () => {
    vi.mocked(Readiness.check).mockRejectedValue(
      new Error("pass binary not found")
    );
    const store = useReadinessStore();
    await store.evaluate("/tmp/store");
    expect(store.error).toBe("pass binary not found");
    expect(store.snapshot).toBeNull();
    expect(store.isEvaluating).toBe(false);
  });

  it("evaluate() error with non-Error throw", async () => {
    vi.mocked(Readiness.check).mockRejectedValue("string error message");
    const store = useReadinessStore();
    await store.evaluate("/tmp/store");
    expect(store.error).toBe("string error message");
    expect(store.snapshot).toBeNull();
    expect(store.isEvaluating).toBe(false);
  });

  it("reset() clears all state", async () => {
    vi.mocked(Readiness.check).mockResolvedValue(readySnapshot);
    const store = useReadinessStore();
    await store.evaluate("/tmp/store");
    expect(store.state).toBe("READY");
    store.reset();
    expect(store.snapshot).toBeNull();
    expect(store.error).toBeNull();
    expect(store.isEvaluating).toBe(false);
    expect(store.state).toBe("NEED_PASS");
  });

  it("blockingIssues only includes severity=blocking", () => {
    const store = useReadinessStore();
    store.snapshot = blockedSnapshot;
    expect(store.blockingIssues).toHaveLength(1);
    expect(store.blockingIssues[0]?.code).toBe("PASS_BINARY_MISSING");
  });

  it("infoIssues only includes severity=info", () => {
    const store = useReadinessStore();
    store.snapshot = blockedSnapshot;
    expect(store.infoIssues).toHaveLength(1);
    expect(store.infoIssues[0]?.code).toBe("STORE_NO_ENTRIES");
  });

  it("isReady is true only when state is READY", async () => {
    const store = useReadinessStore();
    expect(store.isReady).toBe(false);
    vi.mocked(Readiness.check).mockResolvedValue(readySnapshot);
    await store.evaluate("/tmp/store");
    expect(store.isReady).toBe(true);
    vi.mocked(Readiness.check).mockResolvedValue(blockedSnapshot);
    await store.evaluate("/tmp/store");
    expect(store.isReady).toBe(false);
  });

  it("isReady is true for STORE_EMPTY (empty store is usable)", async () => {
    vi.mocked(Readiness.check).mockResolvedValue(emptySnapshot);
    const store = useReadinessStore();
    await store.evaluate("/tmp/store");
    expect(store.state).toBe("STORE_EMPTY");
    expect(store.blockingIssues).toHaveLength(0);
    expect(store.isReady).toBe(true);
  });

  it("sets isEvaluating true during evaluate()", () => {
    vi.mocked(Readiness.check).mockReturnValue(new Promise(() => {}));
    const store = useReadinessStore();
    store.evaluate("/tmp/store");
    expect(store.isEvaluating).toBe(true);
  });
});
