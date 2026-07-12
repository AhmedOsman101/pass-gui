import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/composables/use-generation-config", () => ({
  useGenerationConfig: () => ({
    options: { memorable: false, length: 20, symbols: true },
  }),
}));

vi.mock("@/lib/generate-password", () => ({
  generatePassword: vi.fn(),
  generateMemorablePassword: vi.fn(),
}));

import {
  generateMemorablePassword,
  generatePassword,
} from "@/lib/generate-password";
import { usePasswordGenerator } from "./use-password-generator";

describe("usePasswordGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates password on creation with default non-memorable config", () => {
    vi.mocked(generatePassword).mockReturnValue("p4$$w0rd!");
    const state = usePasswordGenerator();
    expect(state.generated).toBe("p4$$w0rd!");
    expect(generatePassword).toHaveBeenCalledTimes(1);
  });

  it("calls generatePassword with symbols charset when symbols enabled", () => {
    vi.mocked(generatePassword).mockReturnValue("p4$$w0rd!");
    usePasswordGenerator();
    expect(generatePassword).toHaveBeenCalledWith(20, "[[:alnum:]][[:punct:]]");
  });

  it("calls generatePassword with alnum-only charset when symbols disabled", () => {
    vi.mocked(generatePassword).mockReturnValue("abc123");
    const state = usePasswordGenerator();
    vi.mocked(generatePassword).mockClear();
    vi.mocked(generatePassword).mockReturnValue("abc456");
    state.options.symbols = false;
    state.regenerate();
    expect(generatePassword).toHaveBeenCalledWith(20, "[[:alnum:]]");
  });

  it("regenerate() refreshes the generated password", () => {
    vi.mocked(generatePassword)
      .mockReturnValueOnce("firstPass")
      .mockReturnValueOnce("secondPass");
    const state = usePasswordGenerator();
    expect(state.generated).toBe("firstPass");
    state.regenerate();
    expect(state.generated).toBe("secondPass");
  });

  it("uses memorable passphrase generator when memorable=true", () => {
    vi.mocked(generateMemorablePassword).mockReturnValue("1234-foo-bar-baz");
    vi.mocked(generatePassword).mockReturnValue("abc123");
    const state = usePasswordGenerator();
    state.options.memorable = true;
    state.regenerate();
    expect(generateMemorablePassword).toHaveBeenCalled();
    expect(state.generated).toBe("1234-foo-bar-baz");
  });

  it("uses updated length when length option changes", () => {
    vi.mocked(generatePassword).mockReturnValue("pass");
    const state = usePasswordGenerator();
    vi.mocked(generatePassword).mockClear();
    vi.mocked(generatePassword).mockReturnValue("newpass");
    state.options.length = 30;
    state.regenerate();
    expect(generatePassword).toHaveBeenCalledWith(30, "[[:alnum:]][[:punct:]]");
  });

  it("returns reactive state with options, generated, and regenerate", () => {
    vi.mocked(generatePassword).mockReturnValue("test");
    const state = usePasswordGenerator();
    expect(state).toHaveProperty("options");
    expect(state).toHaveProperty("generated");
    expect(state).toHaveProperty("regenerate");
    expect(typeof state.regenerate).toBe("function");
  });

  it("options object is deeply reactive to mutations", () => {
    vi.mocked(generatePassword).mockReturnValue("test");
    const state = usePasswordGenerator();
    state.options.length = 42;
    expect(state.options.length).toBe(42);
    state.options.memorable = true;
    expect(state.options.memorable).toBe(true);
    state.options.symbols = false;
    expect(state.options.symbols).toBe(false);
  });
});
