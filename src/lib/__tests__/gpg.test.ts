import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";

const { execFilePromiseMock } = vi.hoisted(() => ({
  execFilePromiseMock: vi.fn(),
}));

vi.mock("node:child_process", () => {
  const fn = vi.fn() as any;
  fn[promisify.custom] = execFilePromiseMock;
  return { execFile: fn };
});

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
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
  results: Array<{ stdout?: string; stderr?: string; error?: any }>,
) {
  for (const r of results) {
    if (r.error) {
      execFilePromiseMock.mockRejectedValueOnce(r.error);
    } else {
      execFilePromiseMock.mockResolvedValueOnce({
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      });
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
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
    const error = new Error("gpg failed") as any;
    error.stderr = "gpg failed";
    mockGpgCalls([{ error }]);
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
  it("throws GpgError wrapping stderr on execFile rejection", async () => {
    const error = new Error("command failed") as any;
    error.stderr = "gpg: error details";
    mockGpgCalls([{ error }]);
    try {
      await exportPublicKey();
    } catch (e: any) {
      expect(e).toBeInstanceOf(GpgError);
      expect(e.message).toContain("gpg: error details");
    }
  });
});
