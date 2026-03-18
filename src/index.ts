import { createCli } from "./cli.js";

const program = createCli();
program.parseAsync(process.argv);
