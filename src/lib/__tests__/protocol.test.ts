import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

import { buildMessage, parseMessage } from "../protocol.js";
import { ProtocolError } from "../errors.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
});

describe("buildMessage", () => {
  it("generates UUID session when none provided", () => {
    const { session } = buildMessage("init", { need: "help" });
    expect(session).toBe("test-uuid-1234");
  });

  it("uses provided session ID when given", () => {
    const { session } = buildMessage("ack", {}, "my-session");
    expect(session).toBe("my-session");
  });

  it("includes protocol: clawfinder/1", () => {
    const { plaintext } = buildMessage("init", {});
    expect(plaintext).toContain("protocol: clawfinder/1");
  });

  it("includes type field", () => {
    const { plaintext } = buildMessage("propose", {});
    expect(plaintext).toContain("type: propose");
  });

  it("includes session_id field", () => {
    const { plaintext } = buildMessage("init", {});
    expect(plaintext).toContain("session_id: test-uuid-1234");
  });

  it("includes timestamp as valid ISO 8601", () => {
    const { plaintext } = buildMessage("init", {});
    expect(plaintext).toContain("timestamp: 2025-01-15T12:00:00.000Z");
  });

  it('includes all provided fields as "key: value" lines', () => {
    const { plaintext } = buildMessage("init", {
      job_ref: "job-1",
      need: "coding",
    });
    expect(plaintext).toContain("job_ref: job-1");
    expect(plaintext).toContain("need: coding");
  });

  it("filters out undefined values", () => {
    const { plaintext } = buildMessage("init", {
      need: "help",
      extra: undefined as any,
    });
    expect(plaintext).not.toContain("extra");
  });

  it("returns { plaintext, session }", () => {
    const result = buildMessage("init", { need: "x" });
    expect(result).toHaveProperty("plaintext");
    expect(result).toHaveProperty("session");
    expect(typeof result.plaintext).toBe("string");
  });

  it("appends body after blank line when provided", () => {
    const { plaintext } = buildMessage("execute", {}, "s1", "my payload\nline two");
    expect(plaintext).toContain("type: execute");
    expect(plaintext).toContain("\n\nmy payload\nline two");
  });

  it("does not include blank-line body section when body is omitted", () => {
    const { plaintext } = buildMessage("init", { need: "help" });
    expect(plaintext).not.toContain("\n\n");
  });
});

describe("parseMessage", () => {
  it("parses well-formed message into NegotiationMessage", () => {
    const text = "protocol: clawfinder/1\ntype: init\nsession_id: abc\nneed: help";
    const msg = parseMessage(text);
    expect(msg.protocol).toBe("clawfinder/1");
    expect(msg.type).toBe("init");
    expect(msg.session_id).toBe("abc");
    expect(msg.need).toBe("help");
  });

  it("ignores empty lines within header section", () => {
    const text = "protocol: clawfinder/1\ntype: init\nsession_id: abc";
    const msg = parseMessage(text);
    expect(msg.type).toBe("init");
  });

  it("throws ProtocolError for missing/wrong protocol version", () => {
    expect(() => parseMessage("type: init\nsession_id: x")).toThrow(ProtocolError);
    expect(() => parseMessage("protocol: other/2\ntype: init\nsession_id: x")).toThrow(ProtocolError);
  });

  it("throws ProtocolError for missing type field", () => {
    expect(() => parseMessage("protocol: clawfinder/1\nsession_id: x")).toThrow(ProtocolError);
  });

  it("throws ProtocolError for missing session_id field", () => {
    expect(() => parseMessage("protocol: clawfinder/1\ntype: init")).toThrow(ProtocolError);
  });

  it("parses timestamp field", () => {
    const text = "protocol: clawfinder/1\ntype: init\nsession_id: abc\ntimestamp: 2025-01-15T12:00:00.000Z";
    const msg = parseMessage(text);
    expect(msg.timestamp).toBe("2025-01-15T12:00:00.000Z");
  });

  it("parses body section after blank line", () => {
    const text = "protocol: clawfinder/1\ntype: execute\nsession_id: abc\n\nmy payload\nline two";
    const msg = parseMessage(text);
    expect(msg.body).toBe("my payload\nline two");
  });

  it("preserves multiple blank lines in body", () => {
    const text = "protocol: clawfinder/1\ntype: result\nsession_id: abc\n\npart one\n\npart two";
    const msg = parseMessage(text);
    expect(msg.body).toBe("part one\n\npart two");
  });
});
