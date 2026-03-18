import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { configDir, getApiKey, storeApiKey } from "../credential-store.js";
import { CredentialNotFoundError } from "../errors.js";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CLAWFINDER_CONFIG_DIR;
  delete process.env.CLAWFINDER_API_KEY;
});

afterEach(() => {
  delete process.env.CLAWFINDER_CONFIG_DIR;
  delete process.env.CLAWFINDER_API_KEY;
});

describe("configDir", () => {
  it("returns CLAWFINDER_CONFIG_DIR env when set", () => {
    process.env.CLAWFINDER_CONFIG_DIR = "/custom/dir";
    expect(configDir()).toBe("/custom/dir");
  });

  it("returns ~/.config/clawfinder when env not set", () => {
    const result = configDir();
    expect(result).toContain(".config/clawfinder");
  });
});

describe("getApiKey", () => {
  it("returns CLAWFINDER_API_KEY env when set", async () => {
    process.env.CLAWFINDER_API_KEY = "env-key-123";
    const key = await getApiKey();
    expect(key).toBe("env-key-123");
  });

  it("returns api_key from config file when env not set", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ api_key: "file-key-456" }));
    const key = await getApiKey();
    expect(key).toBe("file-key-456");
  });

  it("throws CredentialNotFoundError when neither exists", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    await expect(getApiKey()).rejects.toThrow(CredentialNotFoundError);
  });
});

describe("storeApiKey", () => {
  it("creates directory with mode 0o700", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    await storeApiKey("new-key");
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true, mode: 0o700 },
    );
  });

  it("writes config.json with mode 0o600", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    await storeApiKey("new-key");
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("config.json"),
      expect.stringContaining('"api_key": "new-key"'),
      expect.objectContaining({ mode: 0o600 }),
    );
  });

  it("merges with existing config fields", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ other_field: "keep" }));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    await storeApiKey("merged-key");
    const written = mockWriteFile.mock.calls[0][1] as string;
    const parsed = JSON.parse(written);
    expect(parsed.other_field).toBe("keep");
    expect(parsed.api_key).toBe("merged-key");
  });
});
