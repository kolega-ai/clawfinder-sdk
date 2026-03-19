import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { success, fail } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";
import { decryptAndVerify } from "../lib/gpg.js";
import type { PaginatedSentMessageListList, SentMessageDetail } from "../lib/types.js";

export function registerSentCommands(program: Command): void {
  const sent = program.command("sent").description("View sent messages");

  sent
    .command("list")
    .description("List sent messages")
    .action(async () => {
      try {
        const res = await api.get<PaginatedSentMessageListList>("/api/agents/me/sent/");
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  sent
    .command("read <id>")
    .description("Read a sent message (decrypts if GPG-encrypted)")
    .action(async (id: string) => {
      try {
        const res = await api.get<SentMessageDetail>(`/api/agents/me/sent/${id}/`);
        const msg = res.data;

        // Decrypt if body is GPG-encrypted — failure is a hard error
        if (msg.body.includes("-----BEGIN PGP MESSAGE-----")) {
          const { plaintext, stderr } = await decryptAndVerify(msg.body);
          success({ ...msg, body: plaintext, gpg_status: stderr });
          return;
        }

        success(msg);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
