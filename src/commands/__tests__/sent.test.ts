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
  decryptAndVerify: vi.fn(),
  importKey: vi.fn(),
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

vi.mock("../../lib/credential-store.js", () => ({
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

import { api } from "../../lib/api-client.js";
import { decryptAndVerify, importKey } from "../../lib/gpg.js";
import { createCli } from "../../cli.js";

const mockApi = vi.mocked(api);
const mockDecrypt = vi.mocked(decryptAndVerify);
const mockImportKey = vi.mocked(importKey);

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

describe("sent list", () => {
  it("calls GET /api/agents/me/sent/ with auth", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("sent", "list");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/me/sent/");
  });

  it("outputs success", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("sent", "list");
    expect(output.getStdoutJson().ok).toBe(true);
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.get.mockRejectedValue(new ApiError(401, "unauthorized", {}));
    await run("sent", "list");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});

describe("sent read", () => {
  it("calls GET /api/agents/me/sent/{id}/", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "s1", body: "plain" } } as any);
    await run("sent", "read", "s1");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/me/sent/s1/");
  });

  it("returns raw message when body is plaintext", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "s1", body: "hello" } } as any);
    await run("sent", "read", "s1");
    expect(output.getStdoutJson().data.body).toBe("hello");
  });

  it("decrypts body when it contains BEGIN PGP MESSAGE", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true, status: 200,
      data: { id: "s1", recipient_id: "recipient-uuid", body: "-----BEGIN PGP MESSAGE-----\ndata\n-----END PGP MESSAGE-----" },
    } as any);
    mockApi.get.mockResolvedValueOnce({
      ok: true, status: 200,
      data: { id: "recipient-uuid", pgp_key: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nkey\n-----END PGP PUBLIC KEY BLOCK-----" },
    } as any);
    mockDecrypt.mockResolvedValue({ plaintext: "decrypted", stderr: "sig ok" });
    await run("sent", "read", "s1");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/recipient-uuid/", { auth: false });
    expect(mockImportKey).toHaveBeenCalledWith("-----BEGIN PGP PUBLIC KEY BLOCK-----\nkey\n-----END PGP PUBLIC KEY BLOCK-----");
    const json = output.getStdoutJson();
    expect(json.data.body).toBe("decrypted");
    expect(json.data.gpg_status).toBe("sig ok");
  });

  it("fails with error when decryption fails", async () => {
    const pgpBody = "-----BEGIN PGP MESSAGE-----\ndata\n-----END PGP MESSAGE-----";
    mockApi.get.mockResolvedValueOnce({ ok: true, status: 200, data: { id: "s1", recipient_id: "r1", body: pgpBody } } as any);
    mockApi.get.mockResolvedValueOnce({ ok: true, status: 200, data: { id: "r1", pgp_key: "key" } } as any);
    mockDecrypt.mockRejectedValue(new Error("fail"));
    await run("sent", "read", "s1");
    expect(output.getStderrJson().error.code).toBe("UNKNOWN");
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.get.mockRejectedValue(new ApiError(404, "not found", {}));
    await run("sent", "read", "s1");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});
