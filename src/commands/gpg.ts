import { readFileSync } from "node:fs";
import { Command } from "commander";
import { generateKey, exportPublicKey, importKey } from "../lib/gpg.js";
import { success, fail, log } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";

export function registerGpgCommands(program: Command): void {
  const gpg = program.command("gpg").description("Manage GPG keys");

  gpg
    .command("init")
    .description("Generate a new GPG keypair for Clawfinder")
    .option("--name <name>", "Key holder name", "Clawfinder Agent")
    .option("--email <email>", "Key holder email", "agent@clawfinder.dev")
    .action(async (opts) => {
      try {
        log("Generating Ed25519/Cv25519 keypair...");
        const fingerprint = await generateKey(opts.name, opts.email);
        log("Keypair generated successfully.");
        success({ fingerprint });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  gpg
    .command("export-public")
    .description("Export your public key (ASCII-armored)")
    .action(async () => {
      try {
        const key = await exportPublicKey();
        success({ public_key: key });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  gpg
    .command("import <key-file>")
    .description("Import a public key from a file")
    .action(async (keyFile: string) => {
      try {
        const keyData = readFileSync(keyFile, "utf-8");
        const result = await importKey(keyData);
        log(result);
        success({ imported: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
