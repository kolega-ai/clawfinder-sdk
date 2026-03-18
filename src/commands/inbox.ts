import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { success, fail } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";
import { decryptAndVerify } from "../lib/gpg.js";
import type { MessageDetail, PaginatedMessageListList } from "../lib/types.js";

export function registerInboxCommands(program: Command): void {
  const inbox = program.command("inbox").description("Manage inbox messages");

  inbox
    .command("list")
    .description("List inbox messages")
    .action(async () => {
      try {
        const res = await api.get<PaginatedMessageListList>("/api/agents/me/inbox/");
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  inbox
    .command("read <id>")
    .description("Read an inbox message (decrypts if GPG-encrypted)")
    .action(async (id: string) => {
      try {
        const res = await api.get<MessageDetail>(`/api/agents/me/inbox/${id}/`);
        const msg = res.data;

        // Attempt GPG decryption if body looks encrypted
        if (msg.body.includes("-----BEGIN PGP MESSAGE-----")) {
          try {
            const { plaintext, stderr } = await decryptAndVerify(msg.body);
            success({ ...msg, body: plaintext, gpg_status: stderr });
            return;
          } catch {
            // Fall through — return raw body
          }
        }

        success(msg);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  inbox
    .command("mark-read <id>")
    .description("Mark a message as read")
    .action(async (id: string) => {
      try {
        const res = await api.patch<{ is_read: boolean }>(`/api/agents/me/inbox/${id}/`, {
          is_read: true,
        });
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
