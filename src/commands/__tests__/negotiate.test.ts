import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureOutput, mockProcessExit, ExitError } from "../../__tests__/helpers.js";

vi.mock("../../lib/api-client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../lib/gpg.js", () => ({
  encryptAndSign: vi.fn().mockResolvedValue("ENCRYPTED"),
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

vi.mock("../../lib/protocol.js", () => ({
  buildMessage: vi.fn().mockReturnValue({ plaintext: "protocol-msg", session: "sess-123" }),
}));

vi.mock("../../lib/resolve-body.js", () => ({
  resolveBody: vi.fn().mockReturnValue("body-content"),
}));

vi.mock("../../lib/recipient.js", () => ({
  getRecipientFingerprint: vi.fn().mockResolvedValue("RECIPIENTFPR"),
}));

vi.mock("../../lib/credential-store.js", () => ({
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

import { api } from "../../lib/api-client.js";
import { encryptAndSign } from "../../lib/gpg.js";
import { buildMessage } from "../../lib/protocol.js";
import { resolveBody } from "../../lib/resolve-body.js";
import { getRecipientFingerprint } from "../../lib/recipient.js";
import { createCli } from "../../cli.js";

const mockApi = vi.mocked(api);
const mockBuildMessage = vi.mocked(buildMessage);
const mockResolveBody = vi.mocked(resolveBody);
const mockGetRecipientFpr = vi.mocked(getRecipientFingerprint);
const mockEncryptAndSign = vi.mocked(encryptAndSign);

let output: ReturnType<typeof captureOutput>;
let exitSpy: ReturnType<typeof mockProcessExit>;

beforeEach(() => {
  vi.clearAllMocks();
  output = captureOutput();
  exitSpy = mockProcessExit();
  mockApi.post.mockResolvedValue({ ok: true, status: 201, data: {} } as any);
  mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { username: "testuser" } } as any);
});

async function run(...args: string[]) {
  try {
    await createCli().exitOverride().parseAsync(["node", "clawfinder", ...args]);
  } catch (e) {
    if (!(e instanceof ExitError) && !(e as any).code) throw e;
  }
}

describe("negotiate init", () => {
  it("fetches agent profile and builds init message with spec fields", async () => {
    await run("negotiate", "init", "--to", "agent-1", "--job-ref", "j1", "--need", "coding");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/me/");
    expect(mockBuildMessage).toHaveBeenCalledWith("init", {
      job_ref: "j1",
      need: "coding",
      consumer_username: "testuser",
      index_url: "https://clawfinder.dev",
    });
  });

  it("sends with subject negotiate:init:{session}", async () => {
    await run("negotiate", "init", "--to", "agent-1", "--job-ref", "j1", "--need", "coding");
    expect(mockApi.post).toHaveBeenCalledWith(
      "/api/agents/me/send/",
      expect.objectContaining({ subject: "negotiate:init:sess-123" }),
    );
  });

  it('outputs {session, type:"init", sent:true}', async () => {
    await run("negotiate", "init", "--to", "agent-1", "--job-ref", "j1", "--need", "coding");
    const json = output.getStdoutJson();
    expect(json.data).toEqual({ session: "sess-123", type: "init", sent: true });
  });

  it("uses CLAWFINDER_BASE_URL env var for index_url", async () => {
    const orig = process.env.CLAWFINDER_BASE_URL;
    process.env.CLAWFINDER_BASE_URL = "https://custom.dev";
    try {
      await run("negotiate", "init", "--to", "agent-1", "--job-ref", "j1", "--need", "coding");
      expect(mockBuildMessage).toHaveBeenCalledWith("init", expect.objectContaining({
        index_url: "https://custom.dev",
      }));
    } finally {
      if (orig === undefined) delete process.env.CLAWFINDER_BASE_URL;
      else process.env.CLAWFINDER_BASE_URL = orig;
    }
  });
});

describe("negotiate ack", () => {
  it("builds ack with capabilities/pricing, uses provided session", async () => {
    await run("negotiate", "ack", "--session", "s1", "--to", "agent-1", "--capabilities", "python", "--pricing", "$100");
    expect(mockBuildMessage).toHaveBeenCalledWith("ack", {
      capabilities: "python",
      pricing: "$100",
    }, "s1");
  });

  it("passes constraints when provided", async () => {
    await run("negotiate", "ack", "--session", "s1", "--to", "agent-1", "--capabilities", "python", "--pricing", "$100", "--constraints", "max 1h");
    expect(mockBuildMessage).toHaveBeenCalledWith("ack", {
      capabilities: "python",
      pricing: "$100",
      constraints: "max 1h",
    }, "s1");
  });

  it('outputs {session, type:"ack", sent:true}', async () => {
    mockBuildMessage.mockReturnValue({ plaintext: "msg", session: "s1" });
    await run("negotiate", "ack", "--session", "s1", "--to", "agent-1", "--capabilities", "python", "--pricing", "$100");
    const json = output.getStdoutJson();
    expect(json.data.type).toBe("ack");
    expect(json.data.session).toBe("s1");
  });
});

describe("negotiate propose", () => {
  it("builds propose with capability/price/payment_method", async () => {
    await run("negotiate", "propose", "--session", "s1", "--to", "agent-1", "--capability", "code", "--price", "50", "--payment-method", "invoice");
    expect(mockBuildMessage).toHaveBeenCalledWith("propose", {
      capability: "code",
      price: "50",
      payment_method: "invoice",
    }, "s1");
  });

  it("passes parameters when provided", async () => {
    await run("negotiate", "propose", "--session", "s1", "--to", "agent-1", "--capability", "code", "--price", "50", "--payment-method", "invoice", "--parameters", "lang=python");
    expect(mockBuildMessage).toHaveBeenCalledWith("propose", {
      capability: "code",
      price: "50",
      payment_method: "invoice",
      parameters: "lang=python",
    }, "s1");
  });
});

describe("negotiate counter", () => {
  it("builds counter with price/reason", async () => {
    await run("negotiate", "counter", "--session", "s1", "--to", "agent-1", "--price", "75", "--reason", "too low");
    expect(mockBuildMessage).toHaveBeenCalledWith("counter", {
      price: "75",
      reason: "too low",
    }, "s1");
  });

  it("passes capability when provided", async () => {
    await run("negotiate", "counter", "--session", "s1", "--to", "agent-1", "--price", "75", "--reason", "too low", "--capability", "review");
    expect(mockBuildMessage).toHaveBeenCalledWith("counter", {
      price: "75",
      reason: "too low",
      capability: "review",
    }, "s1");
  });
});

describe("negotiate accept", () => {
  it("builds accept with empty fields", async () => {
    await run("negotiate", "accept", "--session", "s1", "--to", "agent-1");
    expect(mockBuildMessage).toHaveBeenCalledWith("accept", {}, "s1");
  });
});

describe("negotiate reject", () => {
  it("builds reject with reason", async () => {
    await run("negotiate", "reject", "--session", "s1", "--to", "agent-1", "--reason", "no thanks");
    expect(mockBuildMessage).toHaveBeenCalledWith("reject", {
      reason: "no thanks",
    }, "s1");
  });
});

describe("negotiate execute", () => {
  it("calls resolveBody and passes body as separate parameter", async () => {
    await run("negotiate", "execute", "--session", "s1", "--to", "agent-1", "--body", "payload");
    expect(mockResolveBody).toHaveBeenCalled();
    expect(mockBuildMessage).toHaveBeenCalledWith("execute", {}, "s1", "body-content");
  });

  it('outputs {session, type:"execute", sent:true}', async () => {
    mockBuildMessage.mockReturnValue({ plaintext: "msg", session: "s1" });
    await run("negotiate", "execute", "--session", "s1", "--to", "agent-1", "--body", "payload");
    const json = output.getStdoutJson();
    expect(json.data.type).toBe("execute");
  });
});

describe("negotiate result", () => {
  it("passes invoice fields with spec names and body as separate parameter", async () => {
    await run("negotiate", "result", "--session", "s1", "--to", "agent-1",
      "--invoice-amount", "100", "--invoice-wallet", "0xABC",
      "--invoice-payment-method", "crypto", "--body", "deliverable");
    expect(mockResolveBody).toHaveBeenCalled();
    expect(mockBuildMessage).toHaveBeenCalledWith("result", {
      invoice_amount: "100",
      invoice_wallet_address: "0xABC",
      invoice_payment_method: "crypto",
    }, "s1", "body-content");
  });

  it("passes invoice_ref when provided", async () => {
    await run("negotiate", "result", "--session", "s1", "--to", "agent-1",
      "--invoice-amount", "100", "--invoice-wallet", "0xABC",
      "--invoice-payment-method", "crypto", "--invoice-ref", "INV-001", "--body", "deliverable");
    expect(mockBuildMessage).toHaveBeenCalledWith("result", {
      invoice_amount: "100",
      invoice_wallet_address: "0xABC",
      invoice_payment_method: "crypto",
      invoice_ref: "INV-001",
    }, "s1", "body-content");
  });

  it('outputs {session, type:"result", sent:true}', async () => {
    mockBuildMessage.mockReturnValue({ plaintext: "msg", session: "s1" });
    await run("negotiate", "result", "--session", "s1", "--to", "agent-1",
      "--invoice-amount", "100", "--invoice-wallet", "0xABC",
      "--invoice-payment-method", "crypto", "--body", "deliverable");
    const json = output.getStdoutJson();
    expect(json.data.type).toBe("result");
  });
});

describe("error paths", () => {
  it("fails when sendProtocolMessage throws", async () => {
    const { ValidationError } = await import("../../lib/errors.js");
    mockGetRecipientFpr.mockRejectedValue(new ValidationError("no key"));
    await run("negotiate", "init", "--to", "agent-1", "--job-ref", "j1", "--need", "help");
    expect(output.getStderrJson().error.code).toBe("VALIDATION_ERROR");
  });
});
