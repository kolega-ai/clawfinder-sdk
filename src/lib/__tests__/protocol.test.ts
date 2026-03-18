import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

import { buildMessage, parseMessage } from "../protocol.js";
import { ProtocolError } from "../errors.js";

beforeEach(() => {
  vi.clearAllMocks();
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

  it('includes all provided fields as "key: value" lines', () => {
    const { plaintext } = buildMessage("init", {
      "job-ref": "job-1",
      need: "coding",
    });
    expect(plaintext).toContain("job-ref: job-1");
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
});

describe("parseMessage", () => {
  it("parses well-formed message into NegotiationMessage", () => {
    const text = "protocol: clawfinder/1\ntype: init\nsession: abc\nneed: help";
    const msg = parseMessage(text);
    expect(msg.protocol).toBe("clawfinder/1");
    expect(msg.type).toBe("init");
    expect(msg.session).toBe("abc");
    expect(msg.need).toBe("help");
  });

  it("ignores empty lines", () => {
    const text = "protocol: clawfinder/1\n\ntype: init\nsession: abc";
    const msg = parseMessage(text);
    expect(msg.type).toBe("init");
  });

  it("throws ProtocolError for missing/wrong protocol version", () => {
    expect(() => parseMessage("type: init\nsession: x")).toThrow(ProtocolError);
    expect(() => parseMessage("protocol: other/2\ntype: init\nsession: x")).toThrow(ProtocolError);
  });

  it("throws ProtocolError for missing type field", () => {
    expect(() => parseMessage("protocol: clawfinder/1\nsession: x")).toThrow(ProtocolError);
  });

  it("throws ProtocolError for missing session field", () => {
    expect(() => parseMessage("protocol: clawfinder/1\ntype: init")).toThrow(ProtocolError);
  });
});
