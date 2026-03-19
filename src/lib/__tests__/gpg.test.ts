import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter, Writable } from "node:stream";

const { spawnMock, spawnResults } = vi.hoisted(() => {
  const spawnResults: Array<{ stdout?: string; stderr?: string; code?: number; error?: Error }> = [];
  const spawnMock = vi.fn().mockImplementation(() => {
    const result = spawnResults.shift() ?? { stdout: "", stderr: "", code: 0 };
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = new Writable({ write(_chunk, _enc, cb) { cb(); } });

    if (result.error) {
      process.nextTick(() => proc.emit("error", result.error));
    } else {
      process.nextTick(() => {
        if (result.stdout) proc.stdout.emit("data", Buffer.from(result.stdout));
        if (result.stderr) proc.stderr.emit("data", Buffer.from(result.stderr));
        proc.emit("close", result.code ?? 0);
      });
    }
    return proc;
  });
  return { spawnMock, spawnResults };
});

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../credential-store.js", () => ({
  configDir: vi.fn().mockReturnValue("/mock/config"),
}));

import {
  gnupgHome,
  generateKey,
  exportPublicKey,
  importKey,
  encryptAndSign,
  decryptAndVerify,
  listKeys,
} from "../gpg.js";
import { GpgError } from "../errors.js";

function mockGpgCalls(
  results: Array<{ stdout?: string; stderr?: string; code?: number; error?: Error }>,
) {
  spawnResults.push(...results);
}

beforeEach(() => {
  vi.clearAllMocks();
  spawnResults.length = 0;
  delete process.env.CLAWFINDER_GNUPGHOME;
});

describe("gnupgHome", () => {
  it("returns CLAWFINDER_GNUPGHOME env when set", () => {
    process.env.CLAWFINDER_GNUPGHOME = "/custom/gnupg";
    expect(gnupgHome()).toBe("/custom/gnupg");
    delete process.env.CLAWFINDER_GNUPGHOME;
  });

  it("returns configDir()/gnupg when env not set", () => {
    expect(gnupgHome()).toBe("/mock/config/gnupg");
  });
});

describe("generateKey", () => {
  it("calls gpg for key generation and returns fingerprint", async () => {
    mockGpgCalls([
      { stdout: "", stderr: "" }, // quick-generate-key
      { stdout: "fpr:::::::::ABCD1234FINGERPRINT:::\n", stderr: "" }, // fingerprint
      { stdout: "", stderr: "" }, // quick-add-key
    ]);
    const fpr = await generateKey("Test", "test@example.com");
    expect(fpr).toBe("ABCD1234FINGERPRINT");
  });

  it("throws GpgError on gpg failure", async () => {
    mockGpgCalls([{ stderr: "gpg failed", code: 1 }]);
    await expect(generateKey("Test", "test@example.com")).rejects.toThrow(GpgError);
  });
});

describe("exportPublicKey", () => {
  it("returns armored key from stdout", async () => {
    mockGpgCalls([
      { stdout: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nkey data\n-----END PGP PUBLIC KEY BLOCK-----" },
    ]);
    const key = await exportPublicKey();
    expect(key).toContain("BEGIN PGP PUBLIC KEY BLOCK");
  });

  it("throws GpgError when keyring is empty", async () => {
    mockGpgCalls([{ stdout: "" }]);
    await expect(exportPublicKey()).rejects.toThrow(GpgError);
  });
});

describe("importKey", () => {
  it("passes key data as stdin, returns stderr", async () => {
    mockGpgCalls([{ stderr: "gpg: key imported" }]);
    const result = await importKey("key-data");
    expect(result).toBe("gpg: key imported");
  });
});

describe("encryptAndSign", () => {
  it("returns encrypted stdout", async () => {
    mockGpgCalls([
      { stdout: "-----BEGIN PGP MESSAGE-----\nencrypted\n-----END PGP MESSAGE-----" },
    ]);
    const result = await encryptAndSign("hello", "FINGERPRINT");
    expect(result).toContain("BEGIN PGP MESSAGE");
  });
});

describe("decryptAndVerify", () => {
  it("returns {plaintext, stderr}", async () => {
    mockGpgCalls([{ stdout: "decrypted text", stderr: "Good signature" }]);
    const result = await decryptAndVerify("ciphertext");
    expect(result.plaintext).toBe("decrypted text");
    expect(result.stderr).toBe("Good signature");
  });
});

describe("listKeys", () => {
  it("returns stdout from --list-keys", async () => {
    mockGpgCalls([{ stdout: "pub:...\nfpr:::::::::ABC:::" }]);
    const result = await listKeys();
    expect(result).toContain("fpr:");
  });
});

describe("gpg wrapper", () => {
  it("throws GpgError wrapping stderr on non-zero exit", async () => {
    mockGpgCalls([{ stderr: "gpg: error details", code: 2 }]);
    try {
      await exportPublicKey();
    } catch (e: any) {
      expect(e).toBeInstanceOf(GpgError);
      expect(e.message).toContain("gpg: error details");
    }
  });

  it("throws GpgError on spawn error", async () => {
    mockGpgCalls([{ error: new Error("spawn ENOENT") }]);
    try {
      await listKeys();
    } catch (e: any) {
      expect(e).toBeInstanceOf(GpgError);
      expect(e.message).toContain("spawn ENOENT");
    }
  });
});
