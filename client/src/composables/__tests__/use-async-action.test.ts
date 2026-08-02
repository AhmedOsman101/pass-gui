import { Err, Ok, type Result } from "lib-result";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAsyncAction } from "../use-async-action";

class TestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestError";
  }
}

describe("useAsyncAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isLoading=false and error=null before any run", () => {
    const action = async (): Promise<Result<string, Error>> => Ok("x");
    const { isLoading, error } = useAsyncAction(action);

    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("sets isLoading=true during execution and false on success", async () => {
    let resolveAction!: (r: Result<string, Error>) => void;
    const action = (_arg: string): Promise<Result<string, Error>> =>
      new Promise(resolve => {
        resolveAction = resolve;
      });
    const { isLoading, run } = useAsyncAction(action);

    const pending = run("arg1");
    expect(isLoading.value).toBe(true);

    resolveAction(Ok("done"));
    const result = await pending;

    expect(isLoading.value).toBe(false);
    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("done");
  });

  it("sets error ref and clears isLoading on failure", async () => {
    const action = async (): Promise<Result<string, TestError>> =>
      Err(new TestError("boom"));
    const { isLoading, error, run } = useAsyncAction(action);

    const result = await run();

    expect(isLoading.value).toBe(false);
    expect(error.value).toBeInstanceOf(TestError);
    expect(error.value?.message).toBe("boom");
    expect(result.isError()).toBe(true);
  });

  it("resets error to null before each call", async () => {
    const firstAction = async (): Promise<Result<string, TestError>> =>
      Err(new TestError("first"));
    const { error: errA, run: runA } = useAsyncAction(firstAction);
    await runA();
    expect(errA.value).not.toBeNull();

    const okAction = async (): Promise<Result<string, TestError>> =>
      Ok("second");
    const { error: errB, run: runB } = useAsyncAction(okAction);
    const result = await runB();

    expect(errB.value).toBeNull();
    expect(result.isOk()).toBe(true);
    expect(result.ok).toBe("second");
  });

  it("forwards all positional args to the action", async () => {
    const action = vi.fn(
      async (
        _a: string,
        _b: number,
        _c: boolean,
        _d: { x: number }
      ): Promise<Result<number, Error>> => Ok(42)
    );
    const { run } = useAsyncAction(action);

    await run("a", 1, true, { x: 1 });

    expect(action).toHaveBeenCalledWith("a", 1, true, { x: 1 });
  });

  it("returns the same Result the action returned", async () => {
    const ok: Result<string, Error> = Ok("payload");
    const action = async (): Promise<Result<string, Error>> => ok;
    const { run } = useAsyncAction(action);

    const returned = await run();
    expect(returned).toBe(ok);
  });
});
