import { readFileSync } from "node:fs";
import { ValidationError } from "./errors.js";

export function resolveBody(opts: { body?: string; bodyFile?: string }): string {
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
