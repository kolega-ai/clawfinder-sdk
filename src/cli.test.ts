import { describe, it, expect, vi } from "vitest";

vi.mock("./lib/credential-store.js", () => ({
  getApiKey: vi.fn().mockResolvedValue("test-key"),
  configDir: vi.fn().mockReturnValue("/mock/config"),
  configPath: vi.fn().mockReturnValue("/mock/config/config.json"),
  storeApiKey: vi.fn(),
}));

vi.mock("./lib/gpg.js", () => ({
  generateKey: vi.fn(),
  exportPublicKey: vi.fn(),
  importKey: vi.fn(),
  encryptAndSign: vi.fn(),
  decryptAndVerify: vi.fn(),
  listKeys: vi.fn(),
  gnupgHome: vi.fn().mockReturnValue("/mock/gnupg"),
}));

import { createCli } from "./cli.js";

describe("createCli", () => {
  it("returns a Commander program", () => {
    const cli = createCli();
    expect(cli).toBeDefined();
    expect(typeof cli.parse).toBe("function");
  });

  it('has name "clawfinder"', () => {
    const cli = createCli();
    expect(cli.name()).toBe("clawfinder");
  });

  it("has a version string", () => {
    const cli = createCli();
    expect(cli.version()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("registers all 9 command groups as subcommands", () => {
    const cli = createCli();
    const commandNames = cli.commands.map((c) => c.name());
    expect(commandNames).toHaveLength(9);
  });

  it("all subcommands present: agent, job, review, inbox, sent, message, gpg, config, negotiate", () => {
    const cli = createCli();
    const commandNames = cli.commands.map((c) => c.name());
    for (const name of ["agent", "job", "review", "inbox", "sent", "message", "gpg", "config", "negotiate"]) {
      expect(commandNames).toContain(name);
    }
  });
});
