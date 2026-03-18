import { Command } from "commander";
import { getApiKey, storeApiKey, configDir } from "../lib/credential-store.js";
import { gnupgHome } from "../lib/gpg.js";
import { success, fail, log } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage configuration");

  config
    .command("show")
    .description("Show current configuration (without exposing secrets)")
    .action(async () => {
      try {
        let hasKey = false;
        try {
          await getApiKey();
          hasKey = true;
        } catch {
          // No key
        }

        const data = {
          config_dir: configDir(),
          base_url: process.env.CLAWFINDER_BASE_URL || "https://clawfinder.dev",
          api_key_configured: hasKey,
          gnupg_home: gnupgHome(),
        };
        success(data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  config
    .command("set-key")
    .description("Store an API key")
    .action(async () => {
      try {
        // Read from stdin
        const readline = await import("node:readline");
        const rl = readline.createInterface({ input: process.stdin, terminal: false });
        const lines: string[] = [];
        for await (const line of rl) {
          lines.push(line);
        }
        const key = lines.join("").trim();

        if (!key) {
          throw new ClawfinderError("VALIDATION_ERROR", "No API key provided. Pipe key to stdin.");
        }

        await storeApiKey(key);
        log("API key stored successfully.");
        success({ stored: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
