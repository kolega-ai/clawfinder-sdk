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
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

vi.mock("../../lib/credential-store.js", () => ({
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

import { api } from "../../lib/api-client.js";
import { decryptAndVerify } from "../../lib/gpg.js";
import { createCli } from "../../cli.js";

const mockApi = vi.mocked(api);
const mockDecrypt = vi.mocked(decryptAndVerify);

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

describe("inbox list", () => {
  it("calls GET /api/agents/me/inbox/ with auth", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("inbox", "list");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/me/inbox/");
  });

  it("outputs success", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("inbox", "list");
    expect(output.getStdoutJson().ok).toBe(true);
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.get.mockRejectedValue(new ApiError(401, "unauthorized", {}));
    await run("inbox", "list");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});

describe("inbox read", () => {
  it("calls GET /api/agents/me/inbox/{id}/", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "m1", body: "plain text" } } as any);
    await run("inbox", "read", "m1");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/me/inbox/m1/");
  });

  it("returns raw message when body is plaintext", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "m1", body: "hello" } } as any);
    await run("inbox", "read", "m1");
    const json = output.getStdoutJson();
    expect(json.data.body).toBe("hello");
  });

  it("decrypts body when it contains BEGIN PGP MESSAGE", async () => {
    mockApi.get.mockResolvedValue({
      ok: true, status: 200,
      data: { id: "m1", body: "-----BEGIN PGP MESSAGE-----\nstuff\n-----END PGP MESSAGE-----" },
    } as any);
    mockDecrypt.mockResolvedValue({ plaintext: "decrypted!", stderr: "Good signature" });
    await run("inbox", "read", "m1");
    const json = output.getStdoutJson();
    expect(json.data.body).toBe("decrypted!");
    expect(json.data.gpg_status).toBe("Good signature");
  });

  it("falls through to raw body when decryption fails", async () => {
    const pgpBody = "-----BEGIN PGP MESSAGE-----\ndata\n-----END PGP MESSAGE-----";
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "m1", body: pgpBody } } as any);
    mockDecrypt.mockRejectedValue(new Error("decryption failed"));
    await run("inbox", "read", "m1");
    const json = output.getStdoutJson();
    expect(json.data.body).toBe(pgpBody);
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.get.mockRejectedValue(new ApiError(404, "not found", {}));
    await run("inbox", "read", "m1");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});

describe("inbox mark-read", () => {
  it("patches /api/agents/me/inbox/{id}/ with {is_read: true}", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: { is_read: true } } as any);
    await run("inbox", "mark-read", "m1");
    expect(mockApi.patch).toHaveBeenCalledWith("/api/agents/me/inbox/m1/", { is_read: true });
  });

  it("outputs success", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: { is_read: true } } as any);
    await run("inbox", "mark-read", "m1");
    expect(output.getStdoutJson().ok).toBe(true);
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.patch.mockRejectedValue(new ApiError(500, "server error", {}));
    await run("inbox", "mark-read", "m1");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});
