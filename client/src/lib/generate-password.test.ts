import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateMemorablePassword,
  generatePassword,
} from "./generate-password";
import { WORD_LIST } from "./wordlist";

function stubCrypto(returnValue: number) {
  vi.stubGlobal("crypto", {
    getRandomValues: vi.fn((array: Uint32Array) => {
      array[0] = returnValue;
      return array;
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generatePassword", () => {
  it("creates password of exact specified length", () => {
    stubCrypto(0);
    expect(generatePassword(10, "a")).toHaveLength(10);
    expect(generatePassword(1, "a")).toHaveLength(1);
    expect(generatePassword(128, "a")).toHaveLength(128);
  });

  it("returns empty string for length 0", () => {
    stubCrypto(0);
    expect(generatePassword(0, "a")).toBe("");
  });

  it("uses correct charset when crypto returns 0", () => {
    stubCrypto(0);
    expect(generatePassword(5, "XY")).toBe("XXXXX");
  });

  it("expands [[digit]] POSIX class", () => {
    stubCrypto(5);
    expect(generatePassword(1, "[[:digit:]]")).toBe("5");
  });

  it("expands [[alpha]] POSIX class", () => {
    stubCrypto(0);
    expect(generatePassword(1, "[[:alpha:]]")).toBe("a");
  });

  it("expands [[alnum]] POSIX class", () => {
    stubCrypto(0);
    expect(generatePassword(1, "[[:alnum:]]")).toBe("a");
  });

  it("expands [[punct]] POSIX class", () => {
    stubCrypto(0);
    expect(generatePassword(1, "[[:punct:]]")).toBe("!");
  });

  it("expands [[space]] POSIX class", () => {
    stubCrypto(0);
    expect(generatePassword(1, "[[:space:]]")).toBe(" ");
  });

  it("passes literal characters through unchanged", () => {
    stubCrypto(0);
    expect(generatePassword(4, "xyz")).toBe("xxxx");
  });

  it("handles mixed POSIX classes and literals", () => {
    stubCrypto(0);
    expect(generatePassword(1, "[[:digit:]]x")).toBe("0");
  });

  it("does not crash with empty charset", () => {
    stubCrypto(42);
    expect(() => generatePassword(5, "")).not.toThrow();
  });
});

describe("generateMemorablePassword", () => {
  it("returns string matching format NNNN-word-word-word", () => {
    stubCrypto(42);
    expect(generateMemorablePassword()).toMatch(/^\d{4}-[a-z]+-[a-z]+-[a-z]+$/);
  });

  it("uses predictable words from WORD_LIST", () => {
    stubCrypto(42);
    const word = WORD_LIST[42 % WORD_LIST.length] as string;
    expect(generateMemorablePassword()).toBe(`0042-${word}-${word}-${word}`);
  });

  it("zero-pads the 4-digit prefix", () => {
    stubCrypto(42);
    const prefix = generateMemorablePassword().split("-")[0] as string;
    expect(prefix).toBe("0042");
  });
});
