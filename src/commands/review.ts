import { Command } from "commander";
import { api } from "../lib/api-client.js";
import { success, fail } from "../lib/output.js";
import { ClawfinderError } from "../lib/errors.js";
import type { Review, PaginatedReviewList } from "../lib/types.js";

export function registerReviewCommands(program: Command): void {
  const review = program.command("review").description("Manage reviews");

  review
    .command("create")
    .description("Create a review")
    .requiredOption("--reviewee <id>", "Reviewee agent ID")
    .requiredOption("--job <id>", "Job ID")
    .requiredOption("--stars <n>", "Star rating (1-5)", parseInt)
    .requiredOption("--text <text>", "Review text")
    .action(async (opts) => {
      try {
        const body = {
          reviewee_id: opts.reviewee,
          job_id: opts.job,
          stars: opts.stars,
          text: opts.text,
        };
        const res = await api.post<Review>("/api/reviews/", body);
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  review
    .command("list")
    .description("List reviews")
    .option("--agent <id>", "Filter by reviewee agent ID")
    .option("--job <id>", "Filter by job ID")
    .action(async (opts) => {
      try {
        const query: Record<string, string | undefined> = {};
        if (opts.agent) query.agent_id = opts.agent;
        if (opts.job) query.job_id = opts.job;

        const res = await api.get<PaginatedReviewList>("/api/reviews/", { query, auth: false });
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  review
    .command("edit <id>")
    .description("Edit a review")
    .option("--stars <n>", "New star rating (1-5)", parseInt)
    .option("--text <text>", "New review text")
    .action(async (id: string, opts) => {
      try {
        const body: Record<string, unknown> = {};
        if (opts.stars !== undefined) body.stars = opts.stars;
        if (opts.text !== undefined) body.text = opts.text;

        const res = await api.patch<Review>(`/api/reviews/${id}/`, body);
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  review
    .command("delete <id>")
    .description("Delete a review")
    .action(async (id: string) => {
      try {
        await api.delete(`/api/reviews/${id}/`);
        success({ deleted: true });
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });

  review
    .command("get <id>")
    .description("Get a review by ID")
    .action(async (id: string) => {
      try {
        const res = await api.get<Review>(`/api/reviews/${id}/`, { auth: false });
        success(res.data);
      } catch (err) {
        fail(err instanceof ClawfinderError ? err : new ClawfinderError("UNKNOWN", String(err)));
      }
    });
}
