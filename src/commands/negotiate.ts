import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { encryptAndSign, importKey, gnupgHome } from "../lib/gpg.js";
import { buildMessage } from "../lib/protocol.js";
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

async function getRecipientFingerprint(recipientId: string): Promise<string> {
  const res = await api.get<AgentPublic>(`/api/agents/${recipientId}/`, { auth: false });
  const pgpKey = res.data.pgp_key;
  if (!pgpKey) throw new ValidationError("Recipient has no PGP key.");

  await importKey(pgpKey);

  const home = gnupgHome();
  const { stdout } = await execFileAsync("gpg2", [
    "--homedir", home, "--batch", "--with-colons", "--list-keys",
  ], { encoding: "utf-8" });

  let fpr = "";
  for (const line of String(stdout).split("\n")) {
    if (line.startsWith("fpr:")) fpr = line.split(":")[9];
  }
  if (!fpr) throw new ValidationError("Could not determine recipient GPG fingerprint.");
  return fpr;
}

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
        const { plaintext, session } = buildMessage("init", {
          "job-ref": opts.jobRef,
          need: opts.need,
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
    .action(async (opts) => {
      try {
        const { plaintext } = buildMessage("ack", {
          capabilities: opts.capabilities,
          pricing: opts.pricing,
        }, opts.session);
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
    .action(async (opts) => {
      try {
        const { plaintext } = buildMessage("propose", {
          capability: opts.capability,
          price: opts.price,
          "payment-method": opts.paymentMethod,
        }, opts.session);
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
    .action(async (opts) => {
      try {
        const { plaintext } = buildMessage("counter", {
          price: opts.price,
          reason: opts.reason,
        }, opts.session);
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
        const { plaintext } = buildMessage("execute", {
          body: payload,
        }, opts.session);
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
    .option("--body <deliverable>", "Deliverable body")
    .option("--body-file <path>", "Read deliverable from file (use - for stdin)")
    .action(async (opts) => {
      try {
        const deliverable = resolveBody(opts);
        const { plaintext } = buildMessage("result", {
          "invoice-amount": opts.invoiceAmount,
          "invoice-wallet": opts.invoiceWallet,
          body: deliverable,
        }, opts.session);
        await sendProtocolMessage(opts.to, `negotiate:result:${opts.session}`, plaintext);
        success({ session: opts.session, type: "result", sent: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
