import { describe, expect, it } from "vitest";
import { parsePassShowOutput } from "./parse-pass-show";

describe("parsePassShowOutput", () => {
  it("returns error on empty string", () => {
    const result = parsePassShowOutput("");
    expect(result.isError()).toBe(true);
  });

  it("returns error on whitespace-only string", () => {
    const result = parsePassShowOutput("   \n  \n  ");
    expect(result.isError()).toBe(true);
  });

  it("parses a single secret line", () => {
    const result = parsePassShowOutput("my-secret-password");
    expect(result.isError()).toBe(false);
    expect(result.ok?.secret).toBe("my-secret-password");
    expect(result.ok?.metadata).toEqual({});
    expect(result.ok?.other).toEqual([]);
    expect(result.ok?.raw).toBe("my-secret-password");
  });

  it("parses secret with metadata key:value pairs", () => {
    const result = parsePassShowOutput(
      "my-secret\nusername: john\nURL: https://example.com\n"
    );
    expect(result.isError()).toBe(false);
    expect(result.ok?.secret).toBe("my-secret");
    expect(result.ok?.metadata).toEqual({
      username: "john",
      URL: "https://example.com",
    });
    expect(result.ok?.other).toEqual([]);
  });

  it("parses metadata with colon in the value", () => {
    const result = parsePassShowOutput("my-secret\nnotes: time is 10:30 AM\n");
    expect(result.isError()).toBe(false);
    expect(result.ok?.secret).toBe("my-secret");
    expect(result.ok?.metadata).toEqual({ notes: "time is 10:30 AM" });
  });

  it("collects lines without colon separator into other", () => {
    const result = parsePassShowOutput(
      "my-secret\njust a raw note\nanother line\nusername: john\n"
    );
    expect(result.isError()).toBe(false);
    expect(result.ok?.secret).toBe("my-secret");
    expect(result.ok?.metadata).toEqual({ username: "john" });
    expect(result.ok?.other).toEqual(["just a raw note", "another line"]);
  });

  it("handles empty key or value in colon line as other", () => {
    const result = parsePassShowOutput("my-secret\n: emptykey\nkey: val\n");
    expect(result.isError()).toBe(false);
    expect(result.ok?.secret).toBe("my-secret");
    // Lines where key is empty (colon at position 0) go to other
    expect(result.ok?.other).toContain(": emptykey");
    expect(result.ok?.metadata).toEqual({ key: "val" });
  });

  it("preserves the path in the result", () => {
    const result = parsePassShowOutput("my-secret", "Email/work");
    expect(result.isError()).toBe(false);
    expect(result.ok?.path).toBe("Email/work");
  });

  it("defaults path to empty string when not provided", () => {
    const result = parsePassShowOutput("my-secret");
    expect(result.isError()).toBe(false);
    expect(result.ok?.path).toBe("");
  });

  it("strips inline comments from metadata values", () => {
    const result = parsePassShowOutput(
      "my-secret\nemail: john@test.com # work email\n"
    );
    expect(result.isError()).toBe(false);
    expect(result.ok?.metadata).toEqual({
      email: "john@test.com",
    });
  });

  it("handles metadata with trailing whitespace", () => {
    const result = parsePassShowOutput("my-secret\n  key1  :  val1  \n");
    expect(result.isError()).toBe(false);
    expect(result.ok?.metadata).toEqual({ key1: "val1" });
  });

  it("handles multiline other content", () => {
    const result = parsePassShowOutput(
      "my-secret\n---BEGIN CERT---\nbase64data\n---END CERT---\n"
    );
    expect(result.isError()).toBe(false);
    expect(result.ok?.secret).toBe("my-secret");
    expect(result.ok?.other).toEqual([
      "---BEGIN CERT---",
      "base64data",
      "---END CERT---",
    ]);
    expect(result.ok?.metadata).toEqual({});
  });

  it("handles metadata lines that look like hex colors", () => {
    // #ff0000 should NOT be treated as an inline comment
    const result = parsePassShowOutput("my-secret\ncolor: #ff0000\n");
    expect(result.isError()).toBe(false);
    expect(result.ok?.metadata).toEqual({ color: "#ff0000" });
  });

  it("returns EntryParseError with the raw input", () => {
    const result = parsePassShowOutput("");
    expect(result.isError()).toBe(true);
    if (result.isError()) {
      expect(result.error.message).toContain("Empty pass show output");
      expect(result.error.raw).toBe("");
    }
  });
});
