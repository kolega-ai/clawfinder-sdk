import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../credential-store.js", () => ({
  getApiKey: vi.fn().mockResolvedValue("test-api-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { api } from "../api-client.js";
import { ApiError } from "../errors.js";

function jsonResponse(data: unknown, status = 200, statusText = "OK") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CLAWFINDER_BASE_URL;
});

afterEach(() => {
  delete process.env.CLAWFINDER_BASE_URL;
});

describe("api.get", () => {
  it("sends GET to correct URL", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }));
    await api.get("/api/test/");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/test/"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("includes Authorization: Bearer header by default", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.get("/api/test/");
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer test-api-key");
  });

  it("omits auth header when auth:false", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.get("/api/test/", { auth: false });
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBeUndefined();
  });

  it("appends query params, skips undefined ones", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.get("/api/test/", { query: { search: "foo", empty: undefined } });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("search=foo");
    expect(url).not.toContain("empty");
  });

  it("returns parsed JSON data on success", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ name: "test" }));
    const res = await api.get("/api/test/");
    expect(res.data).toEqual({ name: "test" });
  });

  it("returns null data for 204 status", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(""),
    });
    const res = await api.get("/api/test/");
    expect(res.data).toBeNull();
  });
});

describe("api.post", () => {
  it("sends POST with JSON body and Content-Type header", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }, 201, "Created"));
    await api.post("/api/items/", { name: "test" });
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
    expect(callArgs[1].body).toBe(JSON.stringify({ name: "test" }));
  });
});

describe("api.patch", () => {
  it("sends PATCH with JSON body", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }));
    await api.patch("/api/items/1/", { name: "updated" });
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].method).toBe("PATCH");
  });
});

describe("api.delete", () => {
  it("sends DELETE request without body", async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, 204, "No Content"));
    await api.delete("/api/items/1/");
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].method).toBe("DELETE");
    expect(callArgs[1].body).toBeUndefined();
  });
});

describe("error handling", () => {
  it("throws ApiError with status and JSON responseBody on non-ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ detail: "invalid" }),
      text: () => Promise.resolve('{"detail":"invalid"}'),
    });
    await expect(api.get("/api/test/")).rejects.toThrow(ApiError);
    try {
      await api.get("/api/test/");
    } catch (e: any) {
      expect(e.status).toBe(400);
      expect(e.responseBody).toEqual({ detail: "invalid" });
    }
  });

  it("throws ApiError with text responseBody when JSON parse fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
      text: () => Promise.resolve("Server Error"),
    });
    try {
      await api.get("/api/test/");
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.responseBody).toBe("Server Error");
    }
  });

  it("throws ApiError with null responseBody when both fail", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("no json")),
      text: () => Promise.reject(new Error("no text")),
    });
    try {
      await api.get("/api/test/");
    } catch (e: any) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e.responseBody).toBeNull();
    }
  });

  it("includes status text in error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    });
    try {
      await api.get("/api/test/");
    } catch (e: any) {
      expect(e.message).toContain("Not Found");
    }
  });
});
