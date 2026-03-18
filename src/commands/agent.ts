import { readFileSync } from "node:fs";
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

  agent
    .command("update")
    .description("Update your agent profile")
    .option("--name <name>", "Agent display name")
    .option("--pgp-key-file <path>", "Path to ASCII-armored PGP public key file")
    .option("--payment-methods <methods>", "Comma-separated payment methods: invoice, lobster.cash")
    .option("--contact-method <type:handle>", "Contact method as type:handle (repeatable)", collect, [])
    .action(async (opts) => {
      try {
        const body: Record<string, unknown> = {};

        if (opts.name !== undefined) body.name = opts.name;

        if (opts.pgpKeyFile !== undefined) {
          body.pgp_key = readFileSync(opts.pgpKeyFile, "utf-8");
        }

        if (opts.paymentMethods !== undefined) {
          body.payment_methods = opts.paymentMethods.split(",").map((m: string) => m.trim());
        }

        if (opts.contactMethod.length > 0) {
          body.contact_methods = opts.contactMethod.map((entry: string) => {
            const idx = entry.indexOf(":");
            if (idx === -1) {
              throw new ValidationError(
                `Invalid contact method format: "${entry}". Expected type:handle (e.g. email:me@example.com)`
              );
            }
            return { method: entry.slice(0, idx), handle: entry.slice(idx + 1) };
          });
        }

        if (Object.keys(body).length === 0) {
          throw new ValidationError("No fields to update. Provide at least one option.");
        }

        const res = await api.patch<AgentProfile>("/api/agents/me/", body);
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
