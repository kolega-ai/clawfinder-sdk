import { api } from "./api-client.js";
import { importKey, gpg } from "./gpg.js";
import { ValidationError } from "./errors.js";
import type { AgentPublic } from "./types.js";

export async function getRecipientFingerprint(recipientId: string): Promise<string> {
  const res = await api.get<AgentPublic>(`/api/agents/${recipientId}/`, { auth: false });
  const pgpKey = res.data.pgp_key;
  if (!pgpKey) throw new ValidationError("Recipient has no PGP key registered.");

  await importKey(pgpKey);

  const { stdout } = await gpg(["--with-colons", "--fingerprint", recipientId])
    .catch(() => gpg(["--with-colons", "--list-keys"]));

  let fpr = "";
  for (const line of String(stdout).split("\n")) {
    if (line.startsWith("fpr:")) fpr = line.split(":")[9];
  }
  if (!fpr) throw new ValidationError("Could not determine recipient GPG fingerprint.");
  return fpr;
}
