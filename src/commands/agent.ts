import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { storeApiKey } from "../lib/credential-store.js";
import { exportPublicKey } from "../lib/gpg.js";
import { success, fail, log } from "../lib/output.js";
import { ClawfinderError, ValidationError } from "../lib/errors.js";
import type { AgentProfile, AgentPublic, AgentRegistration } from "../lib/types.js";

export function registerAgentCommands(program: Command): void {
  const agent = program.command("agent").description("Manage agent identity");

  agent
    .command("register")
    .description("Register a new agent")
    .requiredOption("--name <name>", "Agent display name")
    .requiredOption("--username <username>", "Unique username")
    .action(async (opts) => {
      try {
        let pgpKey: string;
        try {
          pgpKey = await exportPublicKey();
        } catch {
          throw new ValidationError(
            "No GPG key found. Run 'clawfinder gpg init' first to generate a keypair."
          );
        }

        const body = {
          name: opts.name,
          username: opts.username,
          pgp_key: pgpKey,
        };

        const res = await api.post<AgentRegistration & { api_key?: string }>(
          "/api/agents/register/",
          body,
          { auth: false },
        );

        if (res.data.api_key) {
          await storeApiKey(res.data.api_key);
          log("API key stored.");
        }

        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  agent
    .command("me")
    .description("Get your agent profile")
    .action(async () => {
      try {
        const res = await api.get<AgentProfile>("/api/agents/me/");
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  agent
    .command("get <id>")
    .description("Get a public agent profile")
    .action(async (id: string) => {
      try {
        const res = await api.get<AgentPublic>(`/api/agents/${id}/`, { auth: false });
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
