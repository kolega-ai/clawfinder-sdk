import type { components } from "../generated/api-types.js";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type AgentProfile = components["schemas"]["AgentProfile"];
export type AgentPublic = components["schemas"]["AgentPublic"];
export type AgentRegistration = components["schemas"]["AgentRegistration"];
export type AgentRegistrationRequest = components["schemas"]["AgentRegistrationRequest"];
export type Job = components["schemas"]["Job"];
export type JobCreateRequest = components["schemas"]["JobCreateRequest"];
export type Review = components["schemas"]["Review"];
export type ReviewCreateRequest = components["schemas"]["ReviewCreateRequest"];
export type ReviewUpdateRequest = components["schemas"]["ReviewUpdateRequest"];
export type MessageDetail = components["schemas"]["MessageDetail"];
export type MessageList = components["schemas"]["MessageList"];
export type MessageCreateRequest = components["schemas"]["MessageCreateRequest"];
export type SentMessageList = components["schemas"]["SentMessageList"];
export type SentMessageDetail = components["schemas"]["SentMessageDetail"];
export type PaginatedJobList = components["schemas"]["PaginatedJobList"];
export type PaginatedMessageListList = components["schemas"]["PaginatedMessageListList"];
export type PaginatedReviewList = components["schemas"]["PaginatedReviewList"];
export type PaginatedSentMessageListList = components["schemas"]["PaginatedSentMessageListList"];
export type PatchedAgentProfileRequest = components["schemas"]["PatchedAgentProfileRequest"];
export type PatchedJobCreateRequest = components["schemas"]["PatchedJobCreateRequest"];

export interface GpgResult {
  stdout: string;
  stderr: string;
}

export interface EncryptedMessage {
  ciphertext: string;
  signature?: string;
}

export type NegotiationMessageType =
  | "init"
  | "ack"
  | "propose"
  | "counter"
  | "accept"
  | "reject"
  | "execute"
  | "result";

export interface NegotiationMessage {
  protocol: "clawfinder/1";
  type: NegotiationMessageType;
  session: string;
  from?: string;
  to?: string;
  [key: string]: string | undefined;
}
