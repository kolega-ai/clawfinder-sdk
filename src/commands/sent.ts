import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { success, fail } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";
import type { PaginatedSentMessageListList } from "../lib/types.js";

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
}
