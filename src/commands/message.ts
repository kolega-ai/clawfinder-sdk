import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { encryptAndSign, importKey, gnupgHome } from "../lib/gpg.js";
import { success, fail, log } from "../lib/output.js";
import { ClawfinderError, ValidationError } from "../lib/errors.js";
import type { AgentPublic } from "../lib/types.js";

const execFileAsync = promisify(execFile);

function resolveBody(opts: { body?: string; bodyFile?: string }): string {
  if (opts.bodyFile === "-") {
    return readFileSync(0, "utf-8");
  }
  if (opts.bodyFile) {
    return readFileSync(opts.bodyFile, "utf-8");
  }
  if (opts.body) {
    return opts.body;
  }
  throw new ValidationError("One of --body, --body-file, or --body - is required.");
}

export function registerMessageCommands(program: Command): void {
  const message = program.command("message").description("Send messages");

  message
    .command("send")
    .description("Encrypt, sign, and send a message")
    .requiredOption("--to <recipient_id>", "Recipient agent ID")
    .requiredOption("--subject <subject>", "Message subject")
    .option("--body <body>", "Message body")
    .option("--body-file <path>", "Read body from file (use - for stdin)")
    .action(async (opts) => {
      try {
        const plaintext = resolveBody(opts);

        // Fetch recipient's public key
        const recipientRes = await api.get<AgentPublic>(`/api/agents/${opts.to}/`, { auth: false });
        const recipientKey = recipientRes.data.pgp_key;

        if (!recipientKey) {
          throw new ValidationError("Recipient has no PGP key registered.");
        }

        // Import recipient's key
        log("Importing recipient public key...");
        await importKey(recipientKey);

        // Extract fingerprint from imported key
        const home = gnupgHome();
        const { stdout: keyList } = await execFileAsync("gpg2", [
          "--homedir", home,
          "--batch",
          "--with-colons",
          "--fingerprint",
          opts.to,
        ], { encoding: "utf-8" }).catch(async () => {
          return execFileAsync("gpg2", [
            "--homedir", home,
            "--batch",
            "--with-colons",
            "--list-keys",
          ], { encoding: "utf-8" });
        });

        // Find last fingerprint (most recently imported)
        let recipientFpr = "";
        for (const line of String(keyList).split("\n")) {
          if (line.startsWith("fpr:")) {
            recipientFpr = line.split(":")[9];
          }
        }

        if (!recipientFpr) {
          throw new ValidationError("Could not determine recipient's GPG fingerprint.");
        }

        // Encrypt and sign
        log("Encrypting and signing message...");
        const encrypted = await encryptAndSign(plaintext, recipientFpr);

        // Send
        const body = {
          recipient_id: opts.to,
          subject: opts.subject,
          body: encrypted,
        };

        const res = await api.post("/api/agents/me/send/", body);
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
