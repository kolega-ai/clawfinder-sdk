import { describe, it, expect, vi, beforeEach } from "vitest";
import { promisify } from "node:util";

vi.mock("../api-client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../gpg.js", () => ({
  importKey: vi.fn().mockResolvedValue("imported"),
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

const { execFilePromiseMock } = vi.hoisted(() => ({
  execFilePromiseMock: vi.fn(),
}));

vi.mock("node:child_process", () => {
  const fn = vi.fn() as any;
  fn[promisify.custom] = execFilePromiseMock;
  return { execFile: fn };
});

import { api } from "../api-client.js";
import { getRecipientFingerprint } from "../recipient.js";
import { ValidationError } from "../errors.js";

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRecipientFingerprint", () => {
  it("fetches agent via GET /api/agents/{id}/ with auth:false", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { pgp_key: "KEY" } } as any);
    execFilePromiseMock.mockResolvedValue({ stdout: "fpr:::::::::ABCDEF123456:::\n", stderr: "" });
    await getRecipientFingerprint("agent-1");
    expect(mockApi.get).toHaveBeenCalledWith("/api/agents/agent-1/", { auth: false });
  });

  it("extracts fingerprint via gpg --fingerprint, returns last fpr", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { pgp_key: "KEY" } } as any);
    execFilePromiseMock.mockResolvedValue({
      stdout: "uid:...\nfpr:::::::::FIRST:::\nfpr:::::::::LAST:::\n",
      stderr: "",
    });
    const fpr = await getRecipientFingerprint("agent-1");
    expect(fpr).toBe("LAST");
  });

  it("falls back to --list-keys when --fingerprint fails", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { pgp_key: "KEY" } } as any);
    execFilePromiseMock
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce({ stdout: "fpr:::::::::FALLBACK:::\n", stderr: "" });
    const fpr = await getRecipientFingerprint("agent-1");
    expect(fpr).toBe("FALLBACK");
  });

  it("throws ValidationError when recipient has no PGP key", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { pgp_key: null } } as any);
    await expect(getRecipientFingerprint("agent-1")).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError when no fingerprint found in gpg output", async () => {
    mockApi.get.mockResolvedValue({ ok: true, status: 200, data: { pgp_key: "KEY" } } as any);
    execFilePromiseMock.mockResolvedValue({ stdout: "uid:some-user\npub:...\n", stderr: "" });
    await expect(getRecipientFingerprint("agent-1")).rejects.toThrow(ValidationError);
  });
});
