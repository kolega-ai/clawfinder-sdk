import { readFileSync } from "node:fs";
import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { storeApiKey } from "../lib/credential-store.js";
import { exportPublicKey } from "../lib/gpg.js";
import { success, fail, log } from "../lib/output.js";
import { ClawfinderError, ValidationError } from "../lib/errors.js";
import type { AgentProfile, AgentPublic, AgentRegistration, AgentRegistrationRequest, PatchedAgentProfileRequest } from "../lib/types.js";

const VALID_CONTACT_METHODS = ["email", "index_mailbox", "telegram", "whatsapp"] as const;
const VALID_PAYMENT_METHODS = ["invoice", "lobster.cash"] as const;

type ContactMethod = (typeof VALID_CONTACT_METHODS)[number];
type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number];

function parseContactMethods(entries: string[]): { method: ContactMethod; handle?: string }[] {
  return entries.map((entry) => {
    const idx = entry.indexOf(":");
    let method: string;
    let handle: string | undefined;
    if (idx === -1) {
      method = entry;
    } else {
      method = entry.slice(0, idx);
      handle = entry.slice(idx + 1);
    }
    if (!(VALID_CONTACT_METHODS as readonly string[]).includes(method)) {
      throw new ValidationError(
        `Invalid contact method "${method}". Must be one of: ${VALID_CONTACT_METHODS.join(", ")}`
      );
    }
    return handle !== undefined ? { method: method as ContactMethod, handle } : { method: method as ContactMethod };
  });
}

function parsePaymentMethods(csv: string): PaymentMethod[] {
  const methods = csv.split(",").map((m) => m.trim());
  for (const method of methods) {
    if (!(VALID_PAYMENT_METHODS as readonly string[]).includes(method)) {
      throw new ValidationError(
        `Invalid payment method "${method}". Must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`
      );
    }
  }
  return methods as PaymentMethod[];
}

export function registerAgentCommands(program: Command): void {
  const agent = program.command("agent").description("Manage agent identity");

  agent
    .command("register")
    .description("Register a new agent")
    .requiredOption("--name <name>", "Agent display name")
    .requiredOption("--username <username>", "Unique username")
    .option("--payment-methods <methods>", "Comma-separated payment methods: invoice, lobster.cash")
    .option("--contact-method <type:handle>", "Contact method (repeatable). Format: type or type:handle. Types: email, index_mailbox, telegram, whatsapp", collect, [])
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

        const body: Partial<AgentRegistrationRequest> = {
          name: opts.name,
          username: opts.username,
          pgp_key: pgpKey,
        };

        if (opts.paymentMethods !== undefined) {
          body.payment_methods = parsePaymentMethods(opts.paymentMethods);
        }

        if (opts.contactMethod.length > 0) {
          body.contact_methods = parseContactMethods(opts.contactMethod);
        }

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
    .option("--contact-method <type:handle>", "Contact method (repeatable). Format: type or type:handle. Types: email, index_mailbox, telegram, whatsapp", collect, [])
    .action(async (opts) => {
      try {
        const body: PatchedAgentProfileRequest = {};

        if (opts.name !== undefined) body.name = opts.name;

        if (opts.pgpKeyFile !== undefined) {
          body.pgp_key = readFileSync(opts.pgpKeyFile, "utf-8");
        }

        if (opts.paymentMethods !== undefined) {
          body.payment_methods = parsePaymentMethods(opts.paymentMethods);
        }

        if (opts.contactMethod.length > 0) {
          body.contact_methods = parseContactMethods(opts.contactMethod);
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

  agent
    .command("delete")
    .description("Delete your agent account")
    .action(async () => {
      try {
        await api.delete("/api/agents/me/");
        success({ deleted: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
