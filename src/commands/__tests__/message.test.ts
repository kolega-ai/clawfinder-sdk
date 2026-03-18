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

vi.mock("../../lib/resolve-body.js", () => ({
  resolveBody: vi.fn().mockReturnValue("message body"),
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
import { resolveBody } from "../../lib/resolve-body.js";
import { getRecipientFingerprint } from "../../lib/recipient.js";
import { createCli } from "../../cli.js";

const mockApi = vi.mocked(api);
const mockEncryptAndSign = vi.mocked(encryptAndSign);
const mockResolveBody = vi.mocked(resolveBody);
const mockGetRecipientFpr = vi.mocked(getRecipientFingerprint);

let output: ReturnType<typeof captureOutput>;
let exitSpy: ReturnType<typeof mockProcessExit>;

beforeEach(() => {
  vi.clearAllMocks();
  output = captureOutput();
  exitSpy = mockProcessExit();
});

async function run(...args: string[]) {
  try {
    await createCli().exitOverride().parseAsync(["node", "clawfinder", ...args]);
  } catch (e) {
    if (!(e instanceof ExitError) && !(e as any).code) throw e;
  }
}

describe("message send", () => {
  it("calls resolveBody with opts", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "m1" } } as any);
    await run("message", "send", "--to", "agent-1", "--subject", "Hi", "--body", "Hello");
    expect(mockResolveBody).toHaveBeenCalled();
  });

  it("calls getRecipientFingerprint with recipient ID", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "m1" } } as any);
    await run("message", "send", "--to", "agent-1", "--subject", "Hi", "--body", "Hello");
    expect(mockGetRecipientFpr).toHaveBeenCalledWith("agent-1");
  });

  it("encrypts plaintext with encryptAndSign(plaintext, fingerprint)", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "m1" } } as any);
    await run("message", "send", "--to", "agent-1", "--subject", "Hi", "--body", "Hello");
    expect(mockEncryptAndSign).toHaveBeenCalledWith("message body", "RECIPIENTFPR");
  });

  it("posts to /api/agents/me/send/ with recipient_id, subject, encrypted body", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "m1" } } as any);
    await run("message", "send", "--to", "agent-1", "--subject", "Hi", "--body", "Hello");
    expect(mockApi.post).toHaveBeenCalledWith("/api/agents/me/send/", {
      recipient_id: "agent-1",
      subject: "Hi",
      body: "ENCRYPTED",
    });
  });

  it("outputs success with API response", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "m1" } } as any);
    await run("message", "send", "--to", "agent-1", "--subject", "Hi", "--body", "Hello");
    expect(output.getStdoutJson().ok).toBe(true);
  });

  it("fails when getRecipientFingerprint throws", async () => {
    const { ValidationError } = await import("../../lib/errors.js");
    mockGetRecipientFpr.mockRejectedValueOnce(new ValidationError("no key"));
    await run("message", "send", "--to", "agent-1", "--subject", "Hi", "--body", "Hello");
    expect(output.getStderrJson().error.code).toBe("VALIDATION_ERROR");
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.post.mockRejectedValue(new ApiError(500, "server error", {}));
    await run("message", "send", "--to", "agent-1", "--subject", "Hi", "--body", "Hello");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});
