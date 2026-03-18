import { ClawfinderError } from "./errors.js";

export function success<T>(data: T): void {
  process.stdout.write(JSON.stringify({ ok: true, data }, null, 2) + "\n");
}

export function fail(error: ClawfinderError): never {
  process.stderr.write(JSON.stringify({
    ok: false,
    error: { code: error.code, message: error.message },
  }, null, 2) + "\n");
  process.exit(1);
}

export function log(message: string): void {
  process.stderr.write(message + "\n");
}
