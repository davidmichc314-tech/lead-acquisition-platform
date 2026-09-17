/**
 * Verification worker process (§6/§7 Phase 3). Runs OUTSIDE the Next.js app on a
 * long-running host. Consumes the `verification` queue between enrichment and
 * scoring: verifies the lead's email (best-effort, DNS MX), persists the result,
 * and enqueues scoring. Leads with no email are handled by processVerification —
 * they skip verification but are still enqueued for scoring, so nothing stalls.
 *
 * Start with:  npm run worker:verification
 *
 * Needs a generated Prisma client (`prisma generate`) and a reachable Redis.
 */

import "dotenv/config";

import { Worker } from "bullmq";

import { connection, QUEUE, enqueueScoring, type VerificationJobData } from "../src/lib/jobs/queue";
import { processVerification } from "../src/lib/jobs/verification";
import { dnsEmailVerificationProvider } from "../src/lib/providers/email_verification";
import { shouldMarkFailed, markLeadFailed } from "../src/lib/jobs/failure";
import { prisma } from "../src/lib/db/client";

const worker = new Worker<VerificationJobData>(
  QUEUE.verification,
  async (job) => {
    const { organizationId, searchId, leadId } = job.data;

    return processVerification(
      {
        db: prisma,
        provider: dnsEmailVerificationProvider,
        enqueueScoring: (data) => enqueueScoring(data),
        log: (event, data) => console.log(JSON.stringify({ event, ...data })),
      },
      { organizationId, searchId, leadId },
    );
  },
  { connection, concurrency: 4 },
);

// One lead failing must not fail the search. BullMQ retries per defaultJobOptions;
// only on exhaustion do we durably mark the lead FAILED (tenant-scoped, and never
// overwriting a COMPLETED lead — see markLeadFailed).
worker.on("failed", async (job, err) => {
  console.error(
    JSON.stringify({
      event: "verification.failed",
      leadId: job?.data.leadId,
      searchId: job?.data.searchId,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    }),
  );
  if (job && shouldMarkFailed(job.attemptsMade, job.opts.attempts ?? 1)) {
    await markLeadFailed(prisma, {
      organizationId: job.data.organizationId,
      leadId: job.data.leadId,
    }).catch((e) => console.error(JSON.stringify({ event: "verification.mark_failed_error", leadId: job.data.leadId, error: String(e) })));
  }
});

worker.on("completed", (job) => {
  console.log(JSON.stringify({ event: "verification.completed", leadId: job.data.leadId }));
});

console.log(JSON.stringify({ event: "verification.worker_started", provider: dnsEmailVerificationProvider.key }));