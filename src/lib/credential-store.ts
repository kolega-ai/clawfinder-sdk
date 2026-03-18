import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CredentialNotFoundError } from "./errors.js";

interface Config {
  api_key?: string;
  [key: string]: unknown;
}

export function configDir(): string {
  return process.env.CLAWFINDER_CONFIG_DIR || join(homedir(), ".config", "clawfinder");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

async function readConfig(): Promise<Config> {
  try {
    const raw = await readFile(configPath(), "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

export async function getApiKey(): Promise<string> {
  // 1. Environment variable (CI/containers)
  const envKey = process.env.CLAWFINDER_API_KEY;
  if (envKey) return envKey;

  // 2. Config file
  const config = await readConfig();
  if (config.api_key) return config.api_key;

  throw new CredentialNotFoundError();
}

export async function storeApiKey(key: string): Promise<void> {
  const dir = configDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const config = await readConfig();
  config.api_key = key;

  await writeFile(configPath(), JSON.stringify(config, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });
}
