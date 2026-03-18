import { describe, it, expect, beforeEach } from "vitest";
import { captureOutput, mockProcessExit, ExitError } from "../../__tests__/helpers.js";
import { success, fail, log } from "../output.js";
import { ClawfinderError, ValidationError } from "../errors.js";

let output: ReturnType<typeof captureOutput>;

beforeEach(() => {
  output = captureOutput();
});

describe("success", () => {
  it("writes {ok:true, data} JSON to stdout", () => {
    success({ id: 1 });
    const json = output.getStdoutJson();
    expect(json).toEqual({ ok: true, data: { id: 1 } });
  });

  it("handles null data", () => {
    success(null);
    const json = output.getStdoutJson();
    expect(json).toEqual({ ok: true, data: null });
  });

  it("handles nested objects", () => {
    success({ a: { b: [1, 2] } });
    const json = output.getStdoutJson();
    expect(json.data.a.b).toEqual([1, 2]);
  });
});

describe("fail", () => {
  it("writes {ok:false, error:{code,message}} JSON to stderr and exits", () => {
    const exitSpy = mockProcessExit();
    try {
      fail(new ClawfinderError("TEST", "boom"));
    } catch (e) {
      expect(e).toBeInstanceOf(ExitError);
    }
    const json = output.getStderrJson();
    expect(json).toEqual({ ok: false, error: { code: "TEST", message: "boom" } });
    exitSpy.mockRestore();
  });

  it("calls process.exit(1)", () => {
    const exitSpy = mockProcessExit();
    try {
      fail(new ClawfinderError("X", "y"));
    } catch {
      // expected
    }
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("uses error code and message from ClawfinderError", () => {
    const exitSpy = mockProcessExit();
    try {
      fail(new ValidationError("bad input"));
    } catch {
      // expected
    }
    const json = output.getStderrJson();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toBe("bad input");
    exitSpy.mockRestore();
  });
});

describe("log", () => {
  it("writes message + newline to stderr", () => {
    log("hello");
    expect(output.getStderr()).toBe("hello\n");
  });
});
