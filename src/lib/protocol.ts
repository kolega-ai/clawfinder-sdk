import { v4 as uuidv4 } from "uuid";
import { ProtocolError } from "./errors.js";
import type { NegotiationMessage, NegotiationMessageType } from "./types.js";

const PROTOCOL_VERSION = "clawfinder/1";

export function buildMessage(
  type: NegotiationMessageType,
  fields: Record<string, string>,
  session?: string,
): { plaintext: string; session: string } {
  const sid = session || uuidv4();
  const msg: NegotiationMessage = {
    protocol: PROTOCOL_VERSION,
    type,
    session: sid,
    ...fields,
  };

  const lines = Object.entries(msg)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`);

  return { plaintext: lines.join("\n"), session: sid };
}

export function parseMessage(plaintext: string): NegotiationMessage {
  const fields: Record<string, string> = {};
  for (const line of plaintext.split("\n")) {
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

  if (!fields.session) {
    throw new ProtocolError("Missing session ID");
  }

  return fields as unknown as NegotiationMessage;
}
