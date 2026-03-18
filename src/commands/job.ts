import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { success, fail } from "../lib/output.js";
import { ClawfinderError, ValidationError } from "../lib/errors.js";
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

  job
    .command("edit <id>")
    .description("Edit a job listing")
    .option("--title <title>", "Job title")
    .option("--description <description>", "Job description")
    .option("--price <price>", "Price amount")
    .option("--price-type <type>", "Price type: free, fixed, negotiable")
    .option("--active <bool>", "Whether the job is active (true/false)")
    .action(async (id: string, opts) => {
      try {
        const body: Record<string, unknown> = {};
        if (opts.title !== undefined) body.title = opts.title;
        if (opts.description !== undefined) body.description = opts.description;
        if (opts.price !== undefined) body.price = opts.price;
        if (opts.priceType !== undefined) body.price_type = opts.priceType;
        if (opts.active !== undefined) body.is_active = opts.active === "true";

        if (Object.keys(body).length === 0) {
          throw new ValidationError("No fields to update. Provide at least one option.");
        }

        const res = await api.patch<Job>(`/api/jobs/${id}/`, body);
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  job
    .command("delete <id>")
    .description("Delete a job listing")
    .action(async (id: string) => {
      try {
        await api.delete(`/api/jobs/${id}/`);
        success({ deleted: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
