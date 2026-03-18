import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from "node:fs";
import { resolveBody } from "../resolve-body.js";
import { ValidationError } from "../errors.js";

const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveBody", () => {
  it('reads from stdin when bodyFile is "-"', () => {
    mockReadFileSync.mockReturnValue("stdin content");
    const result = resolveBody({ bodyFile: "-" });
    expect(mockReadFileSync).toHaveBeenCalledWith(0, "utf-8");
    expect(result).toBe("stdin content");
  });

  it("reads from file when bodyFile is a path", () => {
    mockReadFileSync.mockReturnValue("file content");
    const result = resolveBody({ bodyFile: "/tmp/msg.txt" });
    expect(mockReadFileSync).toHaveBeenCalledWith("/tmp/msg.txt", "utf-8");
    expect(result).toBe("file content");
  });

  it("returns literal body value", () => {
    const result = resolveBody({ body: "hello world" });
    expect(result).toBe("hello world");
  });

  it("throws ValidationError when no option provided", () => {
    expect(() => resolveBody({})).toThrow(ValidationError);
  });
});
