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

describe("review create", () => {
  it("posts /api/reviews/ with reviewee_id, job_id, stars, text", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "r1" } } as any);
    await run("review", "create", "--reviewee", "a1", "--job", "j1", "--stars", "5", "--text", "Great");
    expect(mockApi.post).toHaveBeenCalledWith("/api/reviews/", {
      reviewee_id: "a1",
      job_id: "j1",
      stars: 5,
      text: "Great",
    });
  });

  it("parses stars as integer", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "r1" } } as any);
    await run("review", "create", "--reviewee", "a1", "--job", "j1", "--stars", "3", "--text", "OK");
    const body = mockApi.post.mock.calls[0][1] as any;
    expect(body.stars).toBe(3);
    expect(typeof body.stars).toBe("number");
  });

  it("outputs success", async () => {
    mockApi.post.mockResolvedValue({ ok: true, status: 201, data: { id: "r1" } } as any);
    await run("review", "create", "--reviewee", "a1", "--job", "j1", "--stars", "5", "--text", "OK");
    expect(output.getStdoutJson().ok).toBe(true);
  });

  it("fails on API error", async () => {
    const { ApiError } = await import("../../lib/errors.js");
    mockApi.post.mockRejectedValue(new ApiError(400, "bad", {}));
    await run("review", "create", "--reviewee", "a1", "--job", "j1", "--stars", "5", "--text", "OK");
    expect(output.getStderrJson().error.code).toBe("API_ERROR");
  });
});

describe("review list", () => {
  it("calls GET /api/reviews/ with auth:false", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("review", "list");
    expect(mockApi.get).toHaveBeenCalledWith("/api/reviews/", expect.objectContaining({ auth: false }));
  });

  it("passes agent_id query param when --agent given", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("review", "list", "--agent", "a1");
    const opts = mockApi.get.mock.calls[0][1] as any;
    expect(opts.query.agent_id).toBe("a1");
  });

  it("passes job_id query param when --job given", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("review", "list", "--job", "j1");
    const opts = mockApi.get.mock.calls[0][1] as any;
    expect(opts.query.job_id).toBe("j1");
  });

  it("passes both filters together", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { results: [] } } as any);
    await run("review", "list", "--agent", "a1", "--job", "j1");
    const opts = mockApi.get.mock.calls[0][1] as any;
    expect(opts.query.agent_id).toBe("a1");
    expect(opts.query.job_id).toBe("j1");
  });
});

describe("review get", () => {
  it("calls GET /api/reviews/{id}/ with auth:false", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "r1" } } as any);
    await run("review", "get", "r1");
    expect(mockApi.get).toHaveBeenCalledWith("/api/reviews/r1/", { auth: false });
  });

  it("outputs success", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { id: "r1" } } as any);
    await run("review", "get", "r1");
    expect(output.getStdoutJson().ok).toBe(true);
  });
});

describe("review edit", () => {
  it("patches with stars when provided", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: {} } as any);
    await run("review", "edit", "r1", "--stars", "4");
    const body = mockApi.patch.mock.calls[0][1] as any;
    expect(body.stars).toBe(4);
  });

  it("patches with text when provided", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: {} } as any);
    await run("review", "edit", "r1", "--text", "Updated");
    const body = mockApi.patch.mock.calls[0][1] as any;
    expect(body.text).toBe("Updated");
  });

  it("patches with both", async () => {
    mockApi.patch.mockResolvedValue({ ok: true, status: 200, data: {} } as any);
    await run("review", "edit", "r1", "--stars", "2", "--text", "Meh");
    const body = mockApi.patch.mock.calls[0][1] as any;
    expect(body.stars).toBe(2);
    expect(body.text).toBe("Meh");
  });
});

describe("review delete", () => {
  it("calls DELETE, outputs {deleted: true}", async () => {
    mockApi.delete.mockResolvedValue({ ok: true, status: 204, data: null } as any);
    await run("review", "delete", "r1");
    expect(mockApi.delete).toHaveBeenCalledWith("/api/reviews/r1/");
    expect(output.getStdoutJson().data.deleted).toBe(true);
  });
});
