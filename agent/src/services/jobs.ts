import type { Env } from "../env";
import { getSettings } from "../db/settings";
import { logActivity } from "../db/activity";
import { isActionAllowed } from "./publish-policy";

const LEASE_SECONDS = 5 * 60;

export async function runScheduledJobs(env: Env): Promise<void> {
  const settings = await getSettings(env);
  if (!isActionAllowed(settings, "run-job")) {
    await logActivity(env, "job.skipped.paused", "scheduler", null, null, { reason: "Emergency pause is active." });
    return;
  }

  const now = new Date().toISOString();
  const job = await env.DB.prepare(
    `SELECT id, name, attempts, max_attempts FROM jobs
     WHERE status IN ('queued', 'running') AND available_at <= ?
       AND (lease_until IS NULL OR lease_until < ?)
     ORDER BY available_at LIMIT 1`,
  ).bind(now, now).first<{ id: string; name: string; attempts: number; max_attempts: number }>();
  if (!job) return;

  const lease = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
  const claimed = await env.DB.prepare(
    `UPDATE jobs SET status = 'running', lease_until = ?, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND (lease_until IS NULL OR lease_until < ?) AND status IN ('queued', 'running')`,
  ).bind(lease, job.id, now).run();
  if (claimed.meta.changes !== 1) return;

  const runId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO agent_runs (id, job_id, agent_name, status) VALUES (?, ?, ?, 'running')",
  ).bind(runId, job.id, job.name).run();

  try {
    if (job.name !== "heartbeat") throw new Error(`Unknown scheduled agent: ${job.name}.`);
    await logActivity(env, "heartbeat.completed", "heartbeat", "job", job.id, { note: "Scheduled heartbeat ran." });
    await env.DB.prepare(
      "UPDATE jobs SET status = 'done', lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(job.id).run();
    await env.DB.prepare(
      "UPDATE agent_runs SET status = 'succeeded', finished_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(runId).run();
  } catch (error) {
    const attempts = job.attempts + 1;
    const failed = attempts >= job.max_attempts;
    const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(attempts - 1, 7));
    const retryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
    const message = error instanceof Error ? error.message : "Unknown job failure.";
    await env.DB.prepare(
      `UPDATE jobs SET status = ?, lease_until = NULL, available_at = ?, last_error = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(failed ? "failed" : "queued", retryAt, message, job.id).run();
    await env.DB.prepare(
      "UPDATE agent_runs SET status = 'failed', finished_at = CURRENT_TIMESTAMP, error_message = ? WHERE id = ?",
    ).bind(message, runId).run();
    await logActivity(env, "job.failed", "scheduler", "job", job.id, { error: message, retryAt });
    throw error;
  }
}
