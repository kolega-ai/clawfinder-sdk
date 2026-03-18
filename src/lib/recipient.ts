import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { api } from "./api-client.js";
import { importKey, gnupgHome } from "./gpg.js";
import { ValidationError } from "./errors.js";
import type { AgentPublic } from "./types.js";

const execFileAsync = promisify(execFile);

export async function getRecipientFingerprint(recipientId: string): Promise<string> {
  const res = await api.get<AgentPublic>(`/api/agents/${recipientId}/`, { auth: false });
  const pgpKey = res.data.pgp_key;
  if (!pgpKey) throw new ValidationError("Recipient has no PGP key registered.");

  await importKey(pgpKey);

  const home = gnupgHome();
  const { stdout } = await execFileAsync("gpg2", [
    "--homedir", home, "--batch", "--with-colons", "--fingerprint", recipientId,
  ], { encoding: "utf-8" }).catch(async () => {
    return execFileAsync("gpg2", [
      "--homedir", home, "--batch", "--with-colons", "--list-keys",
    ], { encoding: "utf-8" });
  });

  let fpr = "";
  for (const line of String(stdout).split("\n")) {
    if (line.startsWith("fpr:")) fpr = line.split(":")[9];
  }
  if (!fpr) throw new ValidationError("Could not determine recipient GPG fingerprint.");
  return fpr;
}
