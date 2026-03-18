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

vi.mock("../../lib/credential-store.js", () => ({
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

import { api } from "../../lib/api-client.js";
import { createCli } from "../../cli.js";

const mockApi = vi.mocked(api);

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

describe("job create", () => {
  it("posts /api/jobs/ with title and description", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "j1" } } as any);
    await run("job", "create", "--title", "Task", "--description", "Do stuff");
    expect(mockApi.post).toHaveBeenCalledWith(
      "/api/jobs/",
      expect.objectContaining({ title: "Task", description: "Do stuff" }),
    );
  });

  it("includes price when provided", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "j1" } } as any);
    await run("job", "create", "--title", "T", "--description", "D", "--price", "100");
    const body = mockApi.post.mock.calls[0][1] as any;
    expect(body.price).toBe("100");
  });

  it("includes price_type when provided", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "j1" } } as any);
    await run("job", "create", "--title", "T", "--description", "D", "--price-type", "fixed");
    const body = mockApi.post.mock.calls[0][1] as any;
    expect(body.price_type).toBe("fixed");
  });

  it("outputs success", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "j1" } } as any);
    await run("job", "create", "--title", "T", "--description", "D");
    expect(output.getStdoutJson().ok).toBe(true);
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.post.mockRejectedValue(new ApiError(400, "bad", {}));
    await run("job", "create", "--title", "T", "--description", "D");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});

describe("job list", () => {
  it("calls GET /api/jobs/ with auth:false", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("job", "list");
    expect(mockApi.get).toHaveBeenCalledWith("/api/jobs/", expect.objectContaining({ auth: false }));
  });

  it("passes search query param when --search given", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("job", "list", "--search", "python");
    const opts = mockApi.get.mock.calls[0][1] as any;
    expect(opts.query.search).toBe("python");
  });

  it("omits search param when not given", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("job", "list");
    const opts = mockApi.get.mock.calls[0][1] as any;
    expect(opts.query.search).toBeUndefined();
  });
});

describe("job get", () => {
  it("calls GET /api/jobs/{id}/ with auth:false", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "j1" } } as any);
    await run("job", "get", "j1");
    expect(mockApi.get).toHaveBeenCalledWith("/api/jobs/j1/", { auth: false });
  });

  it("outputs success", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "j1" } } as any);
    await run("job", "get", "j1");
    expect(output.getStdoutJson().ok).toBe(true);
  });
});

describe("job edit", () => {
  it("patches /api/jobs/{id}/ with provided fields only", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: { id: "j1" } } as any);
    await run("job", "edit", "j1", "--title", "New Title");
    expect(mockApi.patch).toHaveBeenCalledWith("/api/jobs/j1/", { title: "New Title" });
  });

  it('converts --active "true" to is_active:true', async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: {} } as any);
    await run("job", "edit", "j1", "--active", "true");
    const body = mockApi.patch.mock.calls[0][1] as any;
    expect(body.is_active).toBe(true);
  });

  it('converts --active "false" to is_active:false', async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: {} } as any);
    await run("job", "edit", "j1", "--active", "false");
    const body = mockApi.patch.mock.calls[0][1] as any;
    expect(body.is_active).toBe(false);
  });

  it("fails with VALIDATION_ERROR when no fields provided", async () => {
    await run("job", "edit", "j1");
    expect(output.getStderrJson().error.code).toBe("VALIDATION_ERROR");
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.patch.mockRejectedValue(new ApiError(404, "not found", {}));
    await run("job", "edit", "j1", "--title", "X");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});

describe("job delete", () => {
  it("calls DELETE /api/jobs/{id}/", async () => {
    mockApi.delete.mockResolvedValue({ ok: true, status: 204, data: null } as any);
    await run("job", "delete", "j1");
    expect(mockApi.delete).toHaveBeenCalledWith("/api/jobs/j1/");
  });

  it("outputs success with {deleted: true}", async () => {
    mockApi.delete.mockResolvedValue({ ok: true, status: 204, data: null } as any);
    await run("job", "delete", "j1");
    const json = output.getStdoutJson();
    expect(json.data.deleted).toBe(true);
  });
});
