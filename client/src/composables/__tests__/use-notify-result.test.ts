import { Err, Ok, type Result } from "lib-result";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotifyResult } from "../use-notify-result";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

class CustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomError";
  }
}

describe("useNotifyResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows success toast with default message on Ok", () => {
    const result = Ok("payload") as Result<string, Error>;
    const returned = useNotifyResult(result);

    expect(toast.success).toHaveBeenCalledWith("Success");
    expect(toast.error).not.toHaveBeenCalled();
    expect(returned).toBe(result);
  });

  it("shows error toast with default message (error.message) on Err", () => {
    const result = Err(new CustomError("boom")) as Result<string, CustomError>;
    const returned = useNotifyResult(result);

    expect(toast.error).toHaveBeenCalledWith("boom");
    expect(toast.success).not.toHaveBeenCalled();
    expect(returned).toBe(result);
  });

  it("uses fixed ok string when provided", () => {
    const result = Ok({ name: "Email/work" }) as Result<
      { name: string },
      Error
    >;
    useNotifyResult(result, { ok: "Copied!" });

    expect(toast.success).toHaveBeenCalledWith("Copied!");
  });

  it("derives ok message from value when fn provided", () => {
    const result = Ok({ name: "Email/work" }) as Result<
      { name: string },
      Error
    >;
    useNotifyResult(result, { ok: v => `Copied ${v.name}` });

    expect(toast.success).toHaveBeenCalledWith("Copied Email/work");
  });

  it("uses fixed err string when provided", () => {
    const result = Err(new CustomError("boom")) as Result<string, CustomError>;
    useNotifyResult(result, { err: "Operation failed" });

    expect(toast.error).toHaveBeenCalledWith("Operation failed");
  });

  it("derives err message from error when fn provided", () => {
    const result = Err(new CustomError("boom")) as Result<string, CustomError>;
    useNotifyResult(result, { err: e => `Custom: ${e.message}` });

    expect(toast.error).toHaveBeenCalledWith("Custom: boom");
  });

  it("returns the original Result so caller can chain .match()", () => {
    const ok = Ok("payload") as Result<string, Error>;
    const returned = useNotifyResult(ok, { ok: "Done" });

    let captured: string | undefined;
    returned.match({
      okFn: v => {
        captured = v;
      },
      errFn: () => {},
    });
    expect(captured).toBe("payload");
  });

  it("never mutates the Result value", () => {
    const value = { count: 1 };
    const ok = Ok(value) as Result<{ count: number }, Error>;
    useNotifyResult(ok, { ok: "Done" });

    if (ok.isOk()) {
      expect(ok.ok.count).toBe(1);
    }
  });
});
