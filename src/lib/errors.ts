export class ClawfinderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ClawfinderError";
  }
}

export class CredentialNotFoundError extends ClawfinderError {
  constructor(message = "API key not found. Set CLAWFINDER_API_KEY or run 'clawfinder config set-key'.") {
    super("CREDENTIAL_NOT_FOUND", message);
  }
}

export class ApiError extends ClawfinderError {
  constructor(
    public readonly status: number,
    message: string,
    public readonly responseBody?: unknown,
  ) {
    super("API_ERROR", message);
  }
}

export class GpgError extends ClawfinderError {
  constructor(message: string) {
    super("GPG_ERROR", message);
  }
}

export class ProtocolError extends ClawfinderError {
  constructor(message: string) {
    super("PROTOCOL_ERROR", message);
  }
}

export class ValidationError extends ClawfinderError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}
