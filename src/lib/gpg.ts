import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GpgError } from "./errors.js";
import { configDir } from "./credential-store.js";

export function gnupgHome(): string {
  return process.env.CLAWFINDER_GNUPGHOME || join(configDir(), "gnupg");
}

async function ensureGnupgHome(): Promise<string> {
  const home = gnupgHome();
  await mkdir(home, { recursive: true, mode: 0o700 });
  const agentConf = join(home, "gpg-agent.conf");
  try {
    await writeFile(agentConf, "allow-loopback-pinentry\n", { flag: "wx", mode: 0o600 });
  } catch (err: any) {
    if (err.code !== "EEXIST") throw err;
  }
  return home;
}

export async function gpg(args: string[], input?: string): Promise<{ stdout: string; stderr: string }> {
  const home = await ensureGnupgHome();
  return new Promise((resolve, reject) => {
    const proc = spawn("gpg", ["--homedir", home, "--batch", "--pinentry-mode", "loopback", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString("utf-8"); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString("utf-8"); });
    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new GpgError(stderr || `gpg exited with code ${code}`));
      }
    });
    proc.on("error", (err) => {
      reject(new GpgError(err.message));
    });
  });
}

export async function generateKey(name: string, email: string): Promise<string> {
  await gpg([
    "--quick-generate-key",
    "--passphrase", "",
    `${name} <${email}>`,
    "ed25519",
    "default",
    "0",
  ]);

  // Generate an encryption subkey
  // Extract fingerprint from the key we just generated
  const fpr = await getFingerprint(`${name} <${email}>`);
  await gpg([
    "--quick-add-key",
    "--passphrase", "",
    fpr,
    "cv25519",
    "encr",
    "0",
  ]);

  return fpr;
}

async function getFingerprint(userId: string): Promise<string> {
  const { stdout } = await gpg([
    "--with-colons",
    "--fingerprint",
    userId,
  ]);
  for (const line of stdout.split("\n")) {
    if (line.startsWith("fpr:")) {
      return line.split(":")[9];
    }
  }
  throw new GpgError(`Could not find fingerprint for ${userId}`);
}

export async function exportPublicKey(): Promise<string> {
  const { stdout } = await gpg(["--armor", "--export"]);
  if (!stdout.trim()) {
    throw new GpgError("No public keys found in keyring");
  }
  return stdout;
}

export async function importKey(keyData: string): Promise<string> {
  const { stderr } = await gpg(["--import"], keyData);
  return stderr;
}

export async function encryptAndSign(plaintext: string, recipientFingerprint: string): Promise<string> {
  const { stdout } = await gpg([
    "--armor",
    "--encrypt",
    "--sign",
    "--trust-model", "always",
    "--passphrase", "",
    "--recipient", recipientFingerprint,
  ], plaintext);
  return stdout;
}

export async function decryptAndVerify(ciphertext: string): Promise<{ plaintext: string; stderr: string }> {
  const { stdout, stderr } = await gpg([
    "--decrypt",
    "--passphrase", "",
  ], ciphertext);
  return { plaintext: stdout, stderr };
}

export async function listKeys(): Promise<string> {
  const { stdout } = await gpg(["--list-keys", "--with-colons"]);
  return stdout;
}
