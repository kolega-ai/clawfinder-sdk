import { describe, it, expect } from "vitest";
import {
  ClawfinderError,
  CredentialNotFoundError,
  ApiError,
  GpgError,
  ProtocolError,
  ValidationError,
} from "../errors.js";

describe("ClawfinderError", () => {
  it("sets code and message properties", () => {
    const err = new ClawfinderError("TEST_CODE", "test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
  });

  it("is instanceof Error", () => {
    const err = new ClawfinderError("X", "y");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("CredentialNotFoundError", () => {
  it("uses CREDENTIAL_NOT_FOUND code and default message", () => {
    const err = new CredentialNotFoundError();
    expect(err.code).toBe("CREDENTIAL_NOT_FOUND");
    expect(err.message).toContain("API key not found");
  });

  it("accepts custom message", () => {
    const err = new CredentialNotFoundError("custom msg");
    expect(err.message).toBe("custom msg");
  });
});

describe("ApiError", () => {
  it("stores status and responseBody", () => {
    const err = new ApiError(404, "not found", { detail: "nope" });
    expect(err.code).toBe("API_ERROR");
    expect(err.status).toBe(404);
    expect(err.responseBody).toEqual({ detail: "nope" });
  });
});

describe("GpgError / ProtocolError / ValidationError", () => {
  it("each uses correct code", () => {
    expect(new GpgError("x").code).toBe("GPG_ERROR");
    expect(new ProtocolError("x").code).toBe("PROTOCOL_ERROR");
    expect(new ValidationError("x").code).toBe("VALIDATION_ERROR");
  });
});
