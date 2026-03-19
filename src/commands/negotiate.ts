import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { encryptAndSign } from "../lib/gpg.js";
import { buildMessage } from "../lib/protocol.js";
import { resolveBody } from "../lib/resolve-body.js";
import { getRecipientFingerprint } from "../lib/recipient.js";
import { success, fail, log } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";
import type { AgentProfile } from "../lib/types.js";

async function sendProtocolMessage(
  to: string,
  subject: string,
  plaintext: string,
): Promise<void> {
  const fpr = await getRecipientFingerprint(to);
  log("Encrypting and signing...");
  const encrypted = await encryptAndSign(plaintext, fpr);
  await api.post("/api/agents/me/send/", {
    recipient_id: to,
    subject,
    body: encrypted,
  });
}

export function registerNegotiateCommands(program: Command): void {
  const negotiate = program.command("negotiate").description("Negotiation protocol");

  negotiate
    .command("init")
    .description("Initiate a negotiation session")
    .requiredOption("--to <id>", "Recipient agent ID")
    .requiredOption("--job-ref <id>", "Job reference ID")
    .requiredOption("--need <description>", "Description of need")
    .action(async (opts) => {
      try {
        const profile = await api.get<AgentProfile>("/api/agents/me/");
        const baseUrl = process.env.CLAWFINDER_BASE_URL || "https://clawfinder.dev";
        const { plaintext, session } = buildMessage("init", {
          job_ref: opts.jobRef,
          need: opts.need,
          consumer_username: profile.data.username,
          index_url: baseUrl,
        });
        await sendProtocolMessage(opts.to, `negotiate:init:${session}`, plaintext);
        success({ session, type: "init", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  negotiate
    .command("ack")
    .description("Acknowledge a negotiation request")
    .requiredOption("--session <sid>", "Session ID")
    .requiredOption("--to <id>", "Recipient agent ID")
    .requiredOption("--capabilities <caps>", "Available capabilities")
    .requiredOption("--pricing <pricing>", "Pricing information")
    .option("--constraints <constraints>", "Constraints")
    .action(async (opts) => {
      try {
        const fields: Record<string, string> = {
          capabilities: opts.capabilities,
          pricing: opts.pricing,
        };
        if (opts.constraints) fields.constraints = opts.constraints;
        const { plaintext } = buildMessage("ack", fields, opts.session);
        await sendProtocolMessage(opts.to, `negotiate:ack:${opts.session}`, plaintext);
        success({ session: opts.session, type: "ack", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  negotiate
    .command("propose")
    .description("Send a proposal")
    .requiredOption("--session <sid>", "Session ID")
    .requiredOption("--to <id>", "Recipient agent ID")
    .requiredOption("--capability <cap>", "Requested capability")
    .requiredOption("--price <price>", "Proposed price")
    .requiredOption("--payment-method <method>", "Payment method")
    .option("--parameters <parameters>", "Parameters")
    .action(async (opts) => {
      try {
        const fields: Record<string, string> = {
          capability: opts.capability,
          price: opts.price,
          payment_method: opts.paymentMethod,
        };
        if (opts.parameters) fields.parameters = opts.parameters;
        const { plaintext } = buildMessage("propose", fields, opts.session);
        await sendProtocolMessage(opts.to, `negotiate:propose:${opts.session}`, plaintext);
        success({ session: opts.session, type: "propose", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  negotiate
    .command("counter")
    .description("Counter a proposal")
    .requiredOption("--session <sid>", "Session ID")
    .requiredOption("--to <id>", "Recipient agent ID")
    .requiredOption("--price <price>", "Counter price")
    .requiredOption("--reason <reason>", "Reason for counter")
    .option("--capability <cap>", "Capability")
    .action(async (opts) => {
      try {
        const fields: Record<string, string> = {
          price: opts.price,
          reason: opts.reason,
        };
        if (opts.capability) fields.capability = opts.capability;
        const { plaintext } = buildMessage("counter", fields, opts.session);
        await sendProtocolMessage(opts.to, `negotiate:counter:${opts.session}`, plaintext);
        success({ session: opts.session, type: "counter", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  negotiate
    .command("accept")
    .description("Accept a proposal")
    .requiredOption("--session <sid>", "Session ID")
    .requiredOption("--to <id>", "Recipient agent ID")
    .action(async (opts) => {
      try {
        const { plaintext } = buildMessage("accept", {}, opts.session);
        await sendProtocolMessage(opts.to, `negotiate:accept:${opts.session}`, plaintext);
        success({ session: opts.session, type: "accept", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  negotiate
    .command("reject")
    .description("Reject a proposal")
    .requiredOption("--session <sid>", "Session ID")
    .requiredOption("--to <id>", "Recipient agent ID")
    .requiredOption("--reason <reason>", "Reason for rejection")
    .action(async (opts) => {
      try {
        const { plaintext } = buildMessage("reject", {
          reason: opts.reason,
        }, opts.session);
        await sendProtocolMessage(opts.to, `negotiate:reject:${opts.session}`, plaintext);
        success({ session: opts.session, type: "reject", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  negotiate
    .command("execute")
    .description("Send execution payload")
    .requiredOption("--session <sid>", "Session ID")
    .requiredOption("--to <id>", "Recipient agent ID")
    .option("--body <payload>", "Execution payload")
    .option("--body-file <path>", "Read payload from file (use - for stdin)")
    .action(async (opts) => {
      try {
        const payload = resolveBody(opts);
        const { plaintext } = buildMessage("execute", {}, opts.session, payload);
        await sendProtocolMessage(opts.to, `negotiate:execute:${opts.session}`, plaintext);
        success({ session: opts.session, type: "execute", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  negotiate
    .command("result")
    .description("Send execution result with invoice")
    .requiredOption("--session <sid>", "Session ID")
    .requiredOption("--to <id>", "Recipient agent ID")
    .requiredOption("--invoice-amount <amount>", "Invoice amount")
    .requiredOption("--invoice-wallet <wallet>", "Invoice wallet address")
    .requiredOption("--invoice-payment-method <method>", "Invoice payment method")
    .option("--invoice-ref <ref>", "Invoice reference")
    .option("--body <deliverable>", "Deliverable body")
    .option("--body-file <path>", "Read deliverable from file (use - for stdin)")
    .action(async (opts) => {
      try {
        const deliverable = resolveBody(opts);
        const fields: Record<string, string> = {
          invoice_amount: opts.invoiceAmount,
          invoice_wallet_address: opts.invoiceWallet,
          invoice_payment_method: opts.invoicePaymentMethod,
        };
        if (opts.invoiceRef) fields.invoice_ref = opts.invoiceRef;
        const { plaintext } = buildMessage("result", fields, opts.session, deliverable);
        await sendProtocolMessage(opts.to, `negotiate:result:${opts.session}`, plaintext);
        success({ session: opts.session, type: "result", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
