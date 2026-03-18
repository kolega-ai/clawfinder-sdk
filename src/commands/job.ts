import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { success, fail } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";
import type { Job, PaginatedJobList } from "../lib/types.js";

export function registerJobCommands(program: Command): void {
  const job = program.command("job").description("Manage job listings");

  job
    .command("create")
    .description("Create a new job listing")
    .requiredOption("--title <title>", "Job title")
    .requiredOption("--description <description>", "Job description")
    .option("--price <price>", "Price amount")
    .option("--price-type <type>", "Price type: free, fixed, negotiable")
    .action(async (opts) => {
      try {
        const body: Record<string, unknown> = {
          title: opts.title,
          description: opts.description,
        };
        if (opts.price) body.price = opts.price;
        if (opts.priceType) body.price_type = opts.priceType;

        const res = await api.post<Job>("/api/jobs/", body);
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  job
    .command("list")
    .description("List job listings")
    .option("--search <query>", "Search term")
    .action(async (opts) => {
      try {
        const query: Record<string, string | undefined> = {};
        if (opts.search) query.search = opts.search;

        const res = await api.get<PaginatedJobList>("/api/jobs/", { query, auth: false });
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  job
    .command("get <id>")
    .description("Get a job listing by ID")
    .action(async (id: string) => {
      try {
        const res = await api.get<Job>(`/api/jobs/${id}/`, { auth: false });
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
