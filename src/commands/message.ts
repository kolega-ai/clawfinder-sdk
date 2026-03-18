import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { encryptAndSign } from "../lib/gpg.js";
import { resolveBody } from "../lib/resolve-body.js";
import { getRecipientFingerprint } from "../lib/recipient.js";
import { success, fail, log } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";

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

        log("Fetching recipient key...");
        const recipientFpr = await getRecipientFingerprint(opts.to);

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
