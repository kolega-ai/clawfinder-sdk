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
  exportPublicKey: vi.fn(),
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

vi.mock("../../lib/credential-store.js", () => ({
  storeApiKey: vi.fn().mockResolvedValue(undefined),
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue("pgp-key-data"),
}));

import { api } from "../../lib/api-client.js";
import { exportPublicKey } from "../../lib/gpg.js";
import { storeApiKey } from "../../lib/credential-store.js";
import { createCli } from "../../cli.js";

const mockApi = vi.mocked(api);
const mockExportPublicKey = vi.mocked(exportPublicKey);
const mockStoreApiKey = vi.mocked(storeApiKey);

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

describe("agent register", () => {
  it("exports GPG key, posts /api/agents/register/ with name/username/pgp_key", async () => {
    mockExportPublicKey.mockResolvedValue("PGP-KEY");
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "a1", username: "bob" } } as any);
    await run("agent", "register", "--name", "Bob", "--username", "bob");
    expect(mockExportPublicKey).toHaveBeenCalled();
    expect(mockApi.post).toHaveBeenCalledWith(
      "/api/agents/register/",
      { name: "Bob", username: "bob", pgp_key: "PGP-KEY" },
      { auth: false },
    );
  });

  it("stores API key when response includes api_key field", async () => {
    mockExportPublicKey.mockResolvedValue("PGP-KEY");
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "a1", api_key: "new-key" } } as any);
    await run("agent", "register", "--name", "Bob", "--username", "bob");
    expect(mockStoreApiKey).toHaveBeenCalledWith("new-key");
  });

  it("does not store API key when response lacks api_key", async () => {
    mockExportPublicKey.mockResolvedValue("PGP-KEY");
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "a1" } } as any);
    await run("agent", "register", "--name", "Bob", "--username", "bob");
    expect(mockStoreApiKey).not.toHaveBeenCalled();
  });

  it("outputs success with registration data", async () => {
    mockExportPublicKey.mockResolvedValue("PGP-KEY");
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "a1", username: "bob" } } as any);
    await run("agent", "register", "--name", "Bob", "--username", "bob");
    const json = output.getStdoutJson();
    expect(json.ok).toBe(true);
    expect(json.data.username).toBe("bob");
  });

  it("fails with VALIDATION_ERROR when no GPG key", async () => {
    mockExportPublicKey.mockRejectedValue(new Error("no key"));
    await run("agent", "register", "--name", "Bob", "--username", "bob");
    const json = output.getStderrJson();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("fails with API_ERROR when API call fails", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockExportPublicKey.mockResolvedValue("PGP-KEY");
    mockApi.post.mockRejectedValue(new ApiError(400, "bad request", {}));
    await run("agent", "register", "--name", "Bob", "--username", "bob");
    const json = output.getStderrJson();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("API_ERROR");
  });
});

describe("agent me", () => {
  it("calls GET /api/agents/me/ with auth", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "a1", name: "Me" } } as any);
    await run("agent", "me");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/me/");
  });

  it("outputs success with profile", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "a1", name: "Me" } } as any);
    await run("agent", "me");
    const json = output.getStdoutJson();
    expect(json.ok).toBe(true);
    expect(json.data.name).toBe("Me");
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.get.mockRejectedValue(new ApiError(401, "unauthorized", {}));
    await run("agent", "me");
    const json = output.getStderrJson();
    expect(json.error.code).toBe("API_ERROR");
  });
});

describe("agent get", () => {
  it("calls GET /api/agents/{id}/ with auth:false", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "x", name: "Other" } } as any);
    await run("agent", "get", "x");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/x/", { auth: false });
  });

  it("outputs success", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "x" } } as any);
    await run("agent", "get", "x");
    expect(output.getStdoutJson().ok).toBe(true);
  });
});

describe("agent update", () => {
  it("sends PATCH /api/agents/me/ with --name", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: { name: "New" } } as any);
    await run("agent", "update", "--name", "New");
    expect(mockApi.patch).toHaveBeenCalledWith("/api/agents/me/", { name: "New" });
  });

  it("parses comma-separated --payment-methods into array", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: {} } as any);
    await run("agent", "update", "--payment-methods", "invoice,lobster.cash");
    const body = mockApi.patch.mock.calls[0][1] as any;
    expect(body.payment_methods).toEqual(["invoice", "lobster.cash"]);
  });

  it("parses --contact-method type:handle into [{method, handle}]", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: {} } as any);
    await run("agent", "update", "--contact-method", "email:me@x.com");
    const body = mockApi.patch.mock.calls[0][1] as any;
    expect(body.contact_methods).toEqual([{ method: "email", handle: "me@x.com" }]);
  });

  it("fails with VALIDATION_ERROR for contact method without colon", async () => {
    await run("agent", "update", "--contact-method", "nocolon");
    const json = output.getStderrJson();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("fails with VALIDATION_ERROR when no options provided", async () => {
    await run("agent", "update");
    const json = output.getStderrJson();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
