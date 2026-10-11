import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { reserveProviderUsage } from "../src/services/spend";
import { runScheduledJobs } from "../src/services/jobs";
import { getSettings, setPause } from "../src/db/settings";

describe("spend limits and scheduled jobs", () => {
  it("blocks a real-provider reservation when configured caps are exhausted", async () => {
    const original = await getSettings(env);
    await env.DB.prepare("UPDATE settings SET daily_spend_cap_usd = 0, monthly_spend_cap_usd = 0 WHERE id = 1").run();
    try {
      await expect(reserveProviderUsage({
        ...env,
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "test-model",
        LLM_INPUT_USD_PER_1K_TOKENS: "1",
        LLM_OUTPUT_USD_PER_1K_TOKENS: "1",
      }, "openai", "A test prompt")).rejects.toThrow(/spend cap/);
    } finally {
      await env.DB.prepare("UPDATE settings SET daily_spend_cap_usd = ?, monthly_spend_cap_usd = ? WHERE id = 1")
        .bind(original.dailySpendCapUsd, original.monthlySpendCapUsd).run();
    }
  });

  it("does not run jobs during the emergency pause", async () => {
    const original = await getSettings(env);
    const before = await env.DB.prepare("SELECT COUNT(*) AS count FROM agent_runs").first<{ count: number }>();
    await setPause(env, true);
    try {
      await runScheduledJobs(env);
      const after = await env.DB.prepare("SELECT COUNT(*) AS count FROM agent_runs").first<{ count: number }>();
      expect(after?.count).toBe(before?.count ?? 0);
    } finally {
      await setPause(env, original.paused);
    }
  });

  it("leases and executes one heartbeat job only once", async () => {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO jobs (id, name, idempotency_key) VALUES (?, 'heartbeat', ?)",
    ).bind(id, `test-heartbeat:${id}`).run();
    await Promise.all([runScheduledJobs(env), runScheduledJobs(env)]);
    const job = await env.DB.prepare("SELECT status FROM jobs WHERE id = ?").bind(id).first<{ status: string }>();
    const runs = await env.DB.prepare("SELECT COUNT(*) AS count FROM agent_runs WHERE job_id = ?").bind(id).first<{ count: number }>();
    expect(job?.status).toBe("done");
    expect(runs?.count).toBe(1);
  });
});
