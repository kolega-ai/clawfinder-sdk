import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureOutput, mockProcessExit, ExitError } from "../../__tests__/helpers.js";

vi.mock("../../lib/gpg.js", () => ({
  generateKey: vi.fn(),
  exportPublicKey: vi.fn(),
  importKey: vi.fn(),
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue("key-file-content"),
}));

vi.mock("../../lib/credential-store.js", () => ({
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

import { generateKey, exportPublicKey, importKey } from "../../lib/gpg.js";
import { readFileSync } from "node:fs";
import { createCli } from "../../cli.js";

const mockGenerateKey = vi.mocked(generateKey);
const mockExportPublicKey = vi.mocked(exportPublicKey);
const mockImportKey = vi.mocked(importKey);
const mockReadFileSync = vi.mocked(readFileSync);

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

describe("gpg init", () => {
  it("calls generateKey with default name/email", async () => {
    mockGenerateKey.mockResolvedValue("FPR123");
    await run("gpg", "init");
    expect(mockGenerateKey).toHaveBeenCalledWith("Clawfinder Agent", "agent@clawfinder.dev");
  });

  it("calls generateKey with custom --name and --email", async () => {
    mockGenerateKey.mockResolvedValue("FPR456");
    await run("gpg", "init", "--name", "Bob", "--email", "bob@x.com");
    expect(mockGenerateKey).toHaveBeenCalledWith("Bob", "bob@x.com");
  });

  it("outputs success with {fingerprint}", async () => {
    mockGenerateKey.mockResolvedValue("FPR789");
    await run("gpg", "init");
    const json = output.getStdoutJson();
    expect(json.ok).toBe(true);
    expect(json.data.fingerprint).toBe("FPR789");
  });

  it("fails when generateKey throws GpgError", async () => {
    const { GpgError } = await import("../../lib/errors.js");
    mockGenerateKey.mockRejectedValue(new GpgError("gpg2 not found"));
    await run("gpg", "init");
    const json = output.getStderrJson();
    expect(json.error.code).toBe("GPG_ERROR");
  });
});

describe("gpg export-public", () => {
  it("outputs success with {public_key}", async () => {
    mockExportPublicKey.mockResolvedValue("---KEY---");
    await run("gpg", "export-public");
    const json = output.getStdoutJson();
    expect(json.data.public_key).toBe("---KEY---");
  });

  it("fails when exportPublicKey throws", async () => {
    const { GpgError } = await import("../../lib/errors.js");
    mockExportPublicKey.mockRejectedValue(new GpgError("empty keyring"));
    await run("gpg", "export-public");
    expect(output.getStderrJson().error.code).toBe("GPG_ERROR");
  });
});

describe("gpg import", () => {
  it("reads key file with readFileSync", async () => {
    mockImportKey.mockResolvedValue("imported");
    await run("gpg", "import", "/tmp/key.asc");
    expect(mockReadFileSync).toHaveBeenCalledWith("/tmp/key.asc", "utf-8");
  });

  it("calls importKey with file contents", async () => {
    mockImportKey.mockResolvedValue("imported");
    await run("gpg", "import", "/tmp/key.asc");
    expect(mockImportKey).toHaveBeenCalledWith("key-file-content");
  });

  it("outputs success with {imported: true}", async () => {
    mockImportKey.mockResolvedValue("imported");
    await run("gpg", "import", "/tmp/key.asc");
    expect(output.getStdoutJson().data.imported).toBe(true);
  });

  it("fails when file read throws", async () => {
    mockReadFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
    await run("gpg", "import", "/tmp/no-such.asc");
    expect(output.getStderrJson().ok).toBe(false);
  });
});
