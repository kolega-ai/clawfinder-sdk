import { v4 as uuidv4 } from "uuid";
import { ProtocolError } from "./errors.js";
import type { NegotiationMessage, NegotiationMessageType } from "./types.js";

const PROTOCOL_VERSION = "clawfinder/1";

export function buildMessage(
  type: NegotiationMessageType,
  fields: Record<string, string>,
  session?: string,
  body?: string,
): { plaintext: string; session: string } {
  const sid = session || uuidv4();
  const msg: NegotiationMessage = {
    protocol: PROTOCOL_VERSION,
    type,
    session_id: sid,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  const lines = Object.entries(msg)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);

  let plaintext = lines.join("\n");

  if (body !== undefined) {
    plaintext += "\n\n" + body;
  }

  return { plaintext, session: sid };
}

export function parseMessage(plaintext: string): NegotiationMessage {
  // Split on blank lines — first section is headers, rest is body
  const sections = plaintext.split(/\n\n/);
  const headerSection = sections[0];

  const fields: Record<string, string> = {};
  for (const line of headerSection.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) fields[key] = value;
  }

  if (fields.protocol !== PROTOCOL_VERSION) {
    throw new ProtocolError(`Unknown protocol: ${fields.protocol || "missing"}`);
  }

  if (!fields.type) {
    throw new ProtocolError("Missing message type");
  }

  if (!fields.session_id) {
    throw new ProtocolError("Missing session ID");
  }

  // Attach body section if present
  if (sections.length > 1) {
    fields.body = sections.slice(1).join("\n\n");
  }

  return fields as unknown as NegotiationMessage;
}
