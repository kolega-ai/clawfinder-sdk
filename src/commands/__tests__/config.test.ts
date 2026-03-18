import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureOutput, mockProcessExit, ExitError } from "../../__tests__/helpers.js";

vi.mock("../../lib/credential-store.js", () => ({
  getApiKey: vi.fn(),
  storeApiKey: vi.fn().mockResolvedValue(undefined),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
}));

vi.mock("../../lib/gpg.js", () => ({
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

// Mock node:readline for set-key
vi.mock("node:readline", () => ({
  createInterface: vi.fn().mockReturnValue({
    [Symbol.asyncIterator]: vi.fn(),
  }),
}));

import { getApiKey, storeApiKey } from "../../lib/credential-store.js";
import { createCli } from "../../cli.js";

const mockGetApiKey = vi.mocked(getApiKey);
const mockStoreApiKey = vi.mocked(storeApiKey);

let output: ReturnType<typeof captureOutput>;
let exitSpy: ReturnType<typeof mockProcessExit>;

beforeEach(() => {
  vi.clearAllMocks();
  output = captureOutput();
  exitSpy = mockProcessExit();
  delete process.env.CLAWFINDER_BASE_URL;
});

async function run(...args: string[]) {
  try {
    await createCli().exitOverride().parseAsync(["node", "clawfinder", ...args]);
  } catch (e) {
    if (!(e instanceof ExitError) && !(e as any).code) throw e;
  }
}

describe("config show", () => {
  it("outputs api_key_configured:true when key exists", async () => {
    mockGetApiKey.mockResolvedValue("some-key");
    await run("config", "show");
    const json = output.getStdoutJson();
    expect(json.data.api_key_configured).toBe(true);
  });

  it("outputs api_key_configured:false when getApiKey throws", async () => {
    mockGetApiKey.mockRejectedValue(new Error("no key"));
    await run("config", "show");
    const json = output.getStdoutJson();
    expect(json.data.api_key_configured).toBe(false);
  });

  it("uses CLAWFINDER_BASE_URL env when set", async () => {
    process.env.CLAWFINDER_BASE_URL = "https://custom.dev";
    mockGetApiKey.mockResolvedValue("key");
    await run("config", "show");
    const json = output.getStdoutJson();
    expect(json.data.base_url).toBe("https://custom.dev");
    delete process.env.CLAWFINDER_BASE_URL;
  });

  it("includes config_dir and gnupg_home", async () => {
    mockGetApiKey.mockResolvedValue("key");
    await run("config", "show");
    const json = output.getStdoutJson();
    expect(json.data.config_dir).toBe("/mock/config");
    expect(json.data.gnupg_home).toBe("/mock/gnupg");
  });
});

describe("config set-key", () => {
  it("reads API key from stdin lines and stores it", async () => {
    const { createInterface } = await import("node:readline");
    vi.mocked(createInterface).mockReturnValue({
      [Symbol.asyncIterator]: () => {
        let done = false;
        return {
          next: () => {
            if (!done) {
              done = true;
              return Promise.resolve({ value: "my-api-key", done: false });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    } as any);

    await run("config", "set-key");
    expect(mockStoreApiKey).toHaveBeenCalledWith("my-api-key");
  });

  it("outputs {stored: true}", async () => {
    const { createInterface } = await import("node:readline");
    vi.mocked(createInterface).mockReturnValue({
      [Symbol.asyncIterator]: () => {
        let done = false;
        return {
          next: () => {
            if (!done) {
              done = true;
              return Promise.resolve({ value: "key123", done: false });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    } as any);

    await run("config", "set-key");
    const json = output.getStdoutJson();
    expect(json.data.stored).toBe(true);
  });

  it("fails with VALIDATION_ERROR when stdin is empty", async () => {
    const { createInterface } = await import("node:readline");
    vi.mocked(createInterface).mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.resolve({ value: undefined, done: true }),
      }),
    } as any);

    await run("config", "set-key");
    const json = output.getStderrJson();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
