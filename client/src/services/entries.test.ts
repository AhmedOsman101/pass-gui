import { describe, it, expect, vi, beforeEach } from "vitest";
import { Ok, Err } from "lib-result";
import {
  CommandFailedError,
  MutationError,
  EntryNotFoundError,
  EntryAlreadyExistsError,
  EntryParseError,
} from "@/lib/errors";
import { Pass } from "@/services/pass";

vi.mock("@/services/pass", () => ({
  Pass: {
    exec: vi.fn(),
    storeDirectory: "/home/user/.password-store",
  },
  PassService: vi.fn(),
}));

vi.mock("@/lib/store-walker", () => ({
  walkStore: vi.fn(),
}));

vi.mock("@/lib/parse-pass-show", () => ({
  parsePassShowOutput: vi.fn(),
}));

import { Entries } from "./entries";
import { walkStore } from "@/lib/store-walker";
import { parsePassShowOutput } from "@/lib/parse-pass-show";

const mockEntryTree = [
  {
    name: "Email",
    path: "Email",
    type: "DIRECTORY" as const,
    children: [{ name: "work", path: "Email/work", type: "FILE" as const }],
  },
];

const mockDetail = {
  path: "Email/work",
  secret: "my-secret",
  metadata: { username: "john" },
  other: [],
  raw: "my-secret\nusername: john\n",
};

const mockExecSuccess = {
  pid: 1,
  stdOut: "my-secret\nusername: john\n",
  stdErr: "",
  exitCode: 0,
};

describe("Entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Pass as { storeDirectory: string }).storeDirectory =
      "/home/user/.password-store";
  });

  describe("list", () => {
    it("returns entry tree when store is configured", async () => {
      vi.mocked(walkStore).mockResolvedValue(Ok(mockEntryTree));

      const result = await Entries.list();

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual(mockEntryTree);
    });

    it("returns error when no store is configured", async () => {
      (Pass as { storeDirectory: string }).storeDirectory = "";

      const result = await Entries.list();

      expect(result.isError()).toBe(true);
    });

    it("returns error when walkStore fails", async () => {
      vi.mocked(walkStore).mockResolvedValue(
        Err(new MutationError(1, "store walk error")),
      );

      const result = await Entries.list();

      expect(result.isError()).toBe(true);
    });
  });

  describe("show", () => {
    it("returns parsed entry detail on success", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));
      vi.mocked(parsePassShowOutput).mockReturnValue(Ok(mockDetail));

      const result = await Entries.show("Email/work");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual(mockDetail);
      expect(Pass.exec).toHaveBeenCalledWith(["show", "Email/work"]);
    });

    it("maps 'not in password store' error to EntryNotFoundError", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "missing-entry is not in the password store.",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.show("missing-entry");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(EntryNotFoundError);
    });

    it("maps generic pass error to MutationError with exit code and stderr", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 255,
        stdOut: "",
        stdErr: "unexpected failure",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.show("broken-entry");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
      const mutationErr = result.error as MutationError;
      expect(mutationErr.exitCode).toBe(255);
      expect(mutationErr.stderr).toBe("unexpected failure");
    });

    it("returns MutationError when parsePassShowOutput fails", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));
      vi.mocked(parsePassShowOutput).mockReturnValue(
        Err(new EntryParseError("", "parse error")),
      );

      const result = await Entries.show("bad-parse");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
    });

    it("handles non-CommandFailedError from Pass.exec", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(
        Err(new Error("something went wrong")),
      );

      const result = await Entries.show("weird-error");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
      const mutationErr = result.error as MutationError;
      expect(mutationErr.exitCode).toBe(-1);
    });
  });

  describe("insert", () => {
    const input = { path: "Email/new", content: "my-password\nuser: me\n" };

    it("creates a new entry and returns success", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));

      const result = await Entries.insert(input);

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual({ success: true, path: "Email/new" });
      expect(Pass.exec).toHaveBeenCalledWith(
        ["insert", "-m", "Email/new"],
        { stdIn: input.content },
      );
    });

    it("passes -f flag when force is true", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));

      await Entries.insert({ ...input, force: true });

      expect(Pass.exec).toHaveBeenCalledWith(
        ["insert", "-f", "-m", "Email/new"],
        { stdIn: input.content },
      );
    });

    it("maps 'already exists' to EntryAlreadyExistsError", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "already exists",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.insert(input);

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(EntryAlreadyExistsError);
    });

    it("maps generic pass error to MutationError", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "some error",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.insert(input);

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
    });
  });

  describe("generate", () => {
    it("runs pass generate by default with -f flag", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));

      const result = await Entries.generate("Email/work");

      expect(result.isOk()).toBe(true);
      expect(Pass.exec).toHaveBeenCalledWith(["generate", "-f", "Email/work"]);
    });

    it("uses pass insert with generated password when memorable is true", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));

      const result = await Entries.generate("Email/new", { memorable: true });

      expect(result.isOk()).toBe(true);
      expect(Pass.exec).toHaveBeenCalledWith(
        ["insert", "-f", "Email/new"],
        expect.objectContaining({ stdIn: expect.any(String) }),
      );
    });

    it("returns error when Pass.exec fails", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "error",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.generate("Email/new");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
    });

    it("passes length option to pass generate", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));

      await Entries.generate("Email/long", { length: 40, symbols: true });

      expect(Pass.exec).toHaveBeenCalledWith(["generate", "-f", "Email/long"]);
    });
  });

  describe("remove", () => {
    it("removes an entry and returns success", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));

      const result = await Entries.remove("Email/work");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual({ success: true, path: "Email/work" });
      expect(Pass.exec).toHaveBeenCalledWith(["rm", "-rf", "Email/work"]);
    });

    it("maps 'not in password store' to EntryNotFoundError", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "is not in the password store",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.remove("missing");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(EntryNotFoundError);
    });

    it("maps generic error to MutationError", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "permission denied",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.remove("protected");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
    });
  });

  describe("copy", () => {
    it("copies entry via show then insert", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));
      vi.mocked(parsePassShowOutput).mockReturnValue(Ok(mockDetail));

      const result = await Entries.copy("Email/work", "Email/work-backup");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual({
        success: true,
        path: "Email/work-backup",
        oldPath: "Email/work",
      });
      expect(Pass.exec).toHaveBeenCalledTimes(2);
    });

    it("returns error when show fails (entry not found)", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "is not in the password store",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.copy("missing", "backup");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(EntryNotFoundError);
    });

    it("returns error when insert fails (already exists)", async () => {
      vi.mocked(Pass.exec)
        .mockResolvedValueOnce(Ok(mockExecSuccess))
        .mockResolvedValueOnce(
          Err(
            new CommandFailedError({
              cmd: "pass",
              exitCode: 1,
              stdOut: "",
              stdErr: "already exists",
              pid: 0,
            }),
          ),
        );
      vi.mocked(parsePassShowOutput).mockReturnValue(Ok(mockDetail));

      const result = await Entries.copy("Email/work", "Email/work");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(EntryAlreadyExistsError);
    });
  });

  describe("move", () => {
    it("moves entry successfully", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));

      const result = await Entries.move("Email/work", "Archive/work");

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual({
        success: true,
        path: "Archive/work",
        oldPath: "Email/work",
      });
      expect(Pass.exec).toHaveBeenCalledWith([
        "mv",
        "Email/work",
        "Archive/work",
      ]);
    });

    it("maps 'not in password store' to EntryNotFoundError", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "is not in the password store",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.move("missing", "new-location");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(EntryNotFoundError);
    });

    it("maps generic error to MutationError", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        args: ["mv", "source", "target"],
        exitCode: 1,
        stdOut: "",
        stdErr: "cannot move entry: device error",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.move("source", "target");

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
    });
  });

  describe("edit", () => {
    const content = "new-password\nuser: updated\n";

    it("edits entry via show then insert with force", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(Ok(mockExecSuccess));
      vi.mocked(parsePassShowOutput).mockReturnValue(Ok(mockDetail));

      const result = await Entries.edit("Email/work", content);

      expect(result.isOk()).toBe(true);
      expect(result.ok!).toEqual({ success: true, path: "Email/work" });
      expect(Pass.exec).toHaveBeenCalledTimes(2);
      expect(Pass.exec).toHaveBeenNthCalledWith(1, ["show", "Email/work"]);
      // Second call: insert with force and -m
      expect(Pass.exec).toHaveBeenNthCalledWith(
        2,
        ["insert", "-f", "-m", "Email/work"],
        { stdIn: content },
      );
    });

    it("returns error when show fails (entry not found)", async () => {
      const err = new CommandFailedError({
        cmd: "pass",
        exitCode: 1,
        stdOut: "",
        stdErr: "is not in the password store",
        pid: 0,
      });
      vi.mocked(Pass.exec).mockResolvedValue(Err(err));

      const result = await Entries.edit("missing", content);

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(EntryNotFoundError);
    });

    it("returns error when insert fails", async () => {
      vi.mocked(Pass.exec)
        .mockResolvedValueOnce(Ok(mockExecSuccess))
        .mockResolvedValueOnce(
          Err(
            new CommandFailedError({
              cmd: "pass",
              exitCode: 1,
              stdOut: "",
              stdErr: "could not write",
              pid: 0,
            }),
          ),
        );
      vi.mocked(parsePassShowOutput).mockReturnValue(Ok(mockDetail));

      const result = await Entries.edit("Email/work", content);

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
    });

    it("returns error when show fails with non-CommandFailedError", async () => {
      vi.mocked(Pass.exec).mockResolvedValue(
        Err(new Error("unexpected failure")),
      );

      const result = await Entries.edit("weird", content);

      expect(result.isError()).toBe(true);
      expect(result.error).toBeInstanceOf(MutationError);
      expect((result.error as MutationError).exitCode).toBe(-1);
    });
  });
});
