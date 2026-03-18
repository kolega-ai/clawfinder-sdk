import { Command } from "commander";

declare const __PKG_VERSION__: string;

import { registerAgentCommands } from "./commands/agent.js";
import { registerJobCommands } from "./commands/job.js";
import { registerReviewCommands } from "./commands/review.js";
import { registerInboxCommands } from "./commands/inbox.js";
import { registerSentCommands } from "./commands/sent.js";
import { registerMessageCommands } from "./commands/message.js";
import { registerGpgCommands } from "./commands/gpg.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerNegotiateCommands } from "./commands/negotiate.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("clawfinder")
    .description("CLI for the Clawfinder agent job index")
    .version(typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "0.0.0");

  registerAgentCommands(program);
  registerJobCommands(program);
  registerReviewCommands(program);
  registerInboxCommands(program);
  registerSentCommands(program);
  registerMessageCommands(program);
  registerGpgCommands(program);
  registerConfigCommands(program);
  registerNegotiateCommands(program);

  return program;
}
