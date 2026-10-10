import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";

describe("D1 persistence constraints", () => {
  it("prevents duplicate content through its unique dedupe key", async () => {
    const id = crypto.randomUUID();
    const key = `test-dedupe:${id}`;
    const values = [
      id, "test", "education", "business owners", "awareness", "instagram", "text",
      "A useful hook", "A useful message", "A useful caption", "Get in touch", "[]", "", "",
      "[]", "draft", "https://nearly-x.pages.dev/", "[]", "{}", key,
    ];
    const sql = `INSERT INTO content_items (
      id, campaign_id, pillar_id, target_audience, objective, platform, format, hook, message,
      caption_or_script, call_to_action, keywords_json, visual_direction, alt_text,
      source_references_json, status, destination_url, quality_flags_json, measurement_plan_json, idempotency_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await env.DB.prepare(sql).bind(...values).run();
    await expect(env.DB.prepare(sql).bind(crypto.randomUUID(), ...values.slice(1)).run()).rejects.toThrow(/UNIQUE/);
  });

  it("retains successive brand profile versions", async () => {
    const before = await env.DB.prepare("SELECT MAX(version) AS version FROM brand_profiles").first<{ version: number }>();
    const version = (before?.version ?? 0) + 1;
    await env.DB.prepare(
      "INSERT INTO brand_profiles (version, profile_json, needs_owner_input_json) VALUES (?, ?, ?)",
    ).bind(version, JSON.stringify({ test: "version persistence" }), "[]").run();
    const persisted = await env.DB.prepare("SELECT profile_json FROM brand_profiles WHERE version = ?").bind(version).first<{ profile_json: string }>();
    expect(JSON.parse(persisted?.profile_json ?? "{}")).toEqual({ test: "version persistence" });
  });
});
