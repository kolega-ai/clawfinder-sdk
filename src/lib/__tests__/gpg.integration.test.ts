import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  generateKey,
  exportPublicKey,
  importKey,
  encryptAndSign,
  decryptAndVerify,
  listKeys,
} from "../gpg.js";

const execFileAsync = promisify(execFile);

let tempHome: string;

async function killGpgAgent(home: string): Promise<void> {
  try {
    await execFileAsync("gpgconf", ["--homedir", home, "--kill", "gpg-agent"]);
  } catch {
    // agent may not be running
  }
}

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "clawfinder-gpg-test-"));
  process.env.CLAWFINDER_GNUPGHOME = tempHome;
});

afterEach(async () => {
  await killGpgAgent(tempHome);
  delete process.env.CLAWFINDER_GNUPGHOME;
  await rm(tempHome, { recursive: true, force: true });
});

describe("GPG integration", () => {
  it("generateKey produces a valid fingerprint", async () => {
    const fpr = await generateKey("Test User", "test@example.com");
    expect(fpr).toMatch(/^[A-F0-9]{40}$/);
  }, 30_000);

  it("exportPublicKey returns armored PGP block", async () => {
    await generateKey("Test User", "test@example.com");
    const key = await exportPublicKey();
    expect(key).toContain("BEGIN PGP PUBLIC KEY BLOCK");
  }, 30_000);

  it("importKey accepts a PGP key", async () => {
    await generateKey("Test User", "test@example.com");
    const key = await exportPublicKey();
    // Re-importing the same key proves importKey runs without hanging
    const result = await importKey(key);
    expect(result).toBeDefined();
  }, 30_000);

  it("encryptAndSign + decryptAndVerify round-trip", async () => {
    const fpr = await generateKey("Test User", "test@example.com");

    const plaintext = "Hello, secret world!";
    const ciphertext = await encryptAndSign(plaintext, fpr);
    expect(ciphertext).toContain("BEGIN PGP MESSAGE");
    const { plaintext: decrypted } = await decryptAndVerify(ciphertext);
    expect(decrypted).toBe(plaintext);
  }, 30_000);

  it("listKeys returns colon-format output", async () => {
    await generateKey("Test User", "test@example.com");
    const output = await listKeys();
    expect(output).toContain("pub:");
    expect(output).toContain("fpr:");
  }, 30_000);
});
