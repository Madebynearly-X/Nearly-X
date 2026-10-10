import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { requireAccess, requireOwner } from "./security/auth";
import type { AppEnv, Env } from "./env";
import { logActivity } from "./db/activity";
import { getSettings, setPause } from "./db/settings";
import { isActionAllowed, isOperatingMode } from "./services/publish-policy";
import { buildUtmUrl } from "./services/utm";
import { canTransition, draftSchema, makeIdempotencyKey, platforms, type ContentStatus, type Platform } from "./services/content";
import { qualityFlags } from "./services/quality-control";
import { getProvider, validateProviderDrafts, type LLMProvider, type ProviderResult } from "./providers/llm";
import { reserveProviderUsage, settleProviderUsage, type UsageReservation } from "./services/spend";
import { runScheduledJobs } from "./services/jobs";
import { capabilityRegistry } from "./integrations/registry";
import {
  completeLinkedInAuthorization,
  createLinkedInAuthorization,
  disconnectLinkedIn,
  getLinkedInConnection,
  LinkedInApiError,
  publishLinkedInTextPost,
} from "./integrations/linkedin";
import {
  completeCanvaAuthorization,
  createCanvaAuthorization,
  createCanvaAutofill,
  createCanvaExport,
  disconnectCanva,
  getCanvaAutofill,
  getCanvaConnection,
  getCanvaExport,
} from "./integrations/canva";

const app = new Hono<AppEnv>();
const requireSameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header("Origin");
  if (!origin) return c.json({ error: "A same-origin request is required for this action." }, 403);
  try {
    if (new URL(origin).origin !== new URL(c.req.url).origin) {
      return c.json({ error: "A same-origin request is required for this action." }, 403);
    }
  } catch {
    return c.json({ error: "A same-origin request is required for this action." }, 403);
  }
  await next();
});

app.use("*", async (c, next) => {
  await next();
  c.header("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://cc-embed.adobe.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.adobe.com https://*.adobe.io; frame-src 'self' https://*.adobe.com https://*.adobe.io; img-src 'self' data: https://*.adobe.com https://*.adobe.io; upgrade-insecure-requests");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
});

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.use("*", requireAccess);

app.onError((error, c) => {
  console.error("Agent request failed.", error);
  return c.json({ error: "The request could not be completed." }, 500);
});

const editSchema = z.object({
  hook: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(4000),
  caption: z.string().trim().min(1).max(5000),
  callToAction: z.string().trim().min(1).max(500),
  visualDirection: z.string().max(2000),
  altText: z.string().max(1000),
});

app.patch("/api/content/:id", requireOwner, async (c) => {
  const parsed = editSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid draft edit.", details: parsed.error.flatten() }, 400);
  const id = c.req.param("id");
  const item = await c.env.DB.prepare(
    `SELECT status, platform, format, keywords_json, source_references_json, destination_url
     FROM content_items WHERE id = ?`,
  ).bind(id).first<{
    status: ContentStatus;
    platform: Platform;
    format: string;
    keywords_json: string;
    source_references_json: string;
    destination_url: string;
  }>();
  if (!item) return c.json({ error: "Content item not found." }, 404);
  if (item.status !== "draft" && item.status !== "rejected") {
    return c.json({ error: "Only a draft or rejected item can be edited." }, 409);
  }
  const data = parsed.data;
  const candidate = draftSchema.safeParse({
    platform: item.platform,
    format: item.format,
    hook: data.hook,
    message: data.message,
    caption: data.caption,
    callToAction: data.callToAction,
    keywords: JSON.parse(item.keywords_json),
    visualDirection: data.visualDirection,
    altText: data.altText,
    sourceReferences: JSON.parse(item.source_references_json),
  });
  if (!candidate.success) return c.json({ error: "Draft fields did not pass validation." }, 400);
  const recent = await c.env.DB.prepare(
    "SELECT hook FROM content_items WHERE platform = ? AND id != ? ORDER BY created_at DESC LIMIT 20",
  ).bind(item.platform, id).all<{ hook: string }>();
  const flags = qualityFlags(candidate.data, {
    authorizedPromotionalClaims: (await getSettings(c.env)).authorizedPromotionalClaims,
    destinationUrl: item.destination_url,
    recentOpenings: recent.results.map((row) => row.hook),
  });
  const update = await c.env.DB.prepare(
    `UPDATE content_items SET hook = ?, message = ?, caption_or_script = ?, call_to_action = ?,
     visual_direction = ?, alt_text = ?, quality_flags_json = ?, status = 'draft',
     updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('draft', 'rejected')`,
  ).bind(data.hook, data.message, data.caption, data.callToAction, data.visualDirection, data.altText, JSON.stringify(flags), id).run();
  if (update.meta.changes !== 1) return c.json({ error: "Draft changed concurrently; reload and retry." }, 409);
  await logActivity(c.env, "content.updated", c.get("ownerEmail"), "content", id, { qualityFlags: flags });
  return c.json({ id, status: "draft", qualityFlags: flags });
});

app.get("/api/brand", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT version, profile_json, needs_owner_input_json, created_at FROM brand_profiles ORDER BY version DESC LIMIT 1",
  ).first<{ version: number; profile_json: string; needs_owner_input_json: string; created_at: string }>();
  if (!row) return c.json({ error: "Brand profile is not configured." }, 503);
  return c.json({
    version: row.version,
    profile: JSON.parse(row.profile_json) as Record<string, unknown>,
    needsOwnerInput: JSON.parse(row.needs_owner_input_json) as string[],
    createdAt: row.created_at,
  });
});

const brandSchema = z.object({
  profile: z.record(z.unknown()),
  needsOwnerInput: z.array(z.string().max(160)).max(100),
});

app.put("/api/brand", requireOwner, async (c) => {
  const parsed = brandSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid brand profile.", details: parsed.error.flatten() }, 400);
  const current = await c.env.DB.prepare("SELECT MAX(version) AS version FROM brand_profiles").first<{ version: number | null }>();
  const nextVersion = (current?.version ?? 0) + 1;
  await c.env.DB.prepare(
    "INSERT INTO brand_profiles (version, profile_json, needs_owner_input_json) VALUES (?, ?, ?)",
  ).bind(nextVersion, JSON.stringify(parsed.data.profile), JSON.stringify(parsed.data.needsOwnerInput)).run();
  await logActivity(c.env, "brand_profile.updated", c.get("ownerEmail"), "brand_profile", String(nextVersion));
  return c.json({ version: nextVersion }, 201);
});

app.get("/api/settings", async (c) => c.json(await getSettings(c.env)));

const settingsSchema = z.object({
  operatingMode: z.enum(["SAFE", "SUPERVISED", "AUTONOMOUS"]).optional(),
  dailySpendCapUsd: z.number().min(0).max(100000).optional(),
  monthlySpendCapUsd: z.number().min(0).max(1000000).optional(),
  platformApprovalOverrides: z.record(z.boolean()).optional(),
  categoryApprovalOverrides: z.record(z.boolean()).optional(),
  authorizedPromotionalClaims: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

app.put("/api/settings", requireOwner, async (c) => {
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid settings.", details: parsed.error.flatten() }, 400);
  const data = parsed.data;
  if (data.operatingMode && !isOperatingMode(data.operatingMode)) return c.json({ error: "Invalid operating mode." }, 400);
  const current = await getSettings(c.env);
  const result = await c.env.DB.prepare(
    `UPDATE settings SET operating_mode = ?, daily_spend_cap_usd = ?, monthly_spend_cap_usd = ?,
     platform_approval_overrides = ?, category_approval_overrides = ?, authorized_promotional_claims = ?,
     updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
  ).bind(
    data.operatingMode ?? current.operatingMode,
    data.dailySpendCapUsd ?? current.dailySpendCapUsd,
    data.monthlySpendCapUsd ?? current.monthlySpendCapUsd,
    JSON.stringify(data.platformApprovalOverrides ?? current.platformApprovalOverrides),
    JSON.stringify(data.categoryApprovalOverrides ?? current.categoryApprovalOverrides),
    JSON.stringify(data.authorizedPromotionalClaims ?? current.authorizedPromotionalClaims),
  ).run();
  if (result.meta.changes !== 1) return c.json({ error: "Could not save settings." }, 500);
  await logActivity(c.env, "settings.updated", c.get("ownerEmail"), "settings", "1", data);
  return c.json(await getSettings(c.env));
});

app.post("/api/settings/pause", requireOwner, async (c) => {
  const parsed = z.object({ paused: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Provide a boolean pause state." }, 400);
  await setPause(c.env, parsed.data.paused);
  await logActivity(c.env, parsed.data.paused ? "publishing.paused" : "publishing.resumed", c.get("ownerEmail"), "settings", "1");
  return c.json({ paused: parsed.data.paused });
});

app.get("/api/integrations", requireOwner, async (c) => {
  const canva = await getCanvaConnection(c.env);
  const linkedin = await getLinkedInConnection(c.env, c.get("ownerEmail"));
  const configuredAdobeKey = Boolean(c.env.ADOBE_EXPRESS_EMBED_CLIENT_ID?.trim());
  const adobeApproved = c.env.ADOBE_EXPRESS_EMBED_APPROVED === "true";
  const publicOrigin = c.env.APP_PUBLIC_ORIGIN?.trim();
  let adobeOriginReady = false;
  if (publicOrigin) {
    try {
      const configuredOrigin = new URL(publicOrigin);
      adobeOriginReady = configuredOrigin.protocol === "https:" &&
        configuredOrigin.origin === new URL(c.req.url).origin;
    } catch {
      adobeOriginReady = false;
    }
  }
  const adobeAvailable = configuredAdobeKey && adobeApproved && adobeOriginReady;
  const adobeStatus = !adobeApproved ? "Awaiting approval" as const
    : adobeAvailable ? "Ready to launch" as const
      : "Setup required" as const;
  const capabilities = capabilityRegistry.map((item) => {
    if (item.platform === "Canva") {
      return { ...item, connection: canva.connected ? "Connected" as const : "Not connected" as const };
    }
    if (item.platform === "LinkedIn") {
      return { ...item, connection: linkedin.connected ? "Connected" as const : "Not connected" as const };
    }
    if (item.platform === "Adobe Express") {
      return {
        ...item,
        connection: adobeStatus,
      };
    }
    return item;
  });
  return c.json({
    capabilities,
    canva,
    linkedin,
    adobeExpress: {
      available: adobeAvailable,
      clientId: adobeAvailable ? c.env.ADOBE_EXPRESS_EMBED_CLIENT_ID?.trim() : null,
      appName: "NEARLY Studio",
    },
  });
});

app.post("/api/integrations/linkedin/connect", requireOwner, requireSameOrigin, async (c) => {
  try {
    return c.json({ authorizationUrl: await createLinkedInAuthorization(c.env, c.get("ownerEmail")) });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "LinkedIn connection could not be started." }, 503);
  }
});

app.get("/api/integrations/linkedin/callback", requireOwner, async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (c.req.query("error")) return c.redirect("/?integration=linkedin-denied");
  if (!code || !state || code.length > 2000 || state.length > 500) return c.redirect("/?integration=linkedin-error");
  try {
    await completeLinkedInAuthorization(c.env, code, state, c.get("ownerEmail"));
    await logActivity(c.env, "integration.connected", c.get("ownerEmail"), "integration", "linkedin");
    return c.redirect("/?integration=linkedin-connected");
  } catch {
    await logActivity(c.env, "integration.connection_failed", c.get("ownerEmail"), "integration", "linkedin");
    return c.redirect("/?integration=linkedin-error");
  }
});

app.delete("/api/integrations/linkedin", requireOwner, requireSameOrigin, async (c) => {
  await disconnectLinkedIn(c.env, c.get("ownerEmail"));
  await logActivity(c.env, "integration.disconnected", c.get("ownerEmail"), "integration", "linkedin");
  return c.json({ connected: false });
});

app.post("/api/integrations/canva/connect", requireOwner, async (c) => {
  try {
    return c.json({ authorizationUrl: await createCanvaAuthorization(c.env, c.get("ownerEmail")) });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Canva connection could not be started." }, 503);
  }
});

app.get("/api/integrations/canva/callback", requireOwner, async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (c.req.query("error")) return c.redirect("/?integration=canva-denied");
  if (!code || !state) return c.redirect("/?integration=canva-error");
  try {
    await completeCanvaAuthorization(c.env, code, state, c.get("ownerEmail"));
    await logActivity(c.env, "integration.connected", c.get("ownerEmail"), "integration", "canva");
    return c.redirect("/?integration=canva-connected");
  } catch (error) {
    console.error("Canva OAuth callback failed.", error);
    return c.redirect("/?integration=canva-error");
  }
});

app.delete("/api/integrations/canva", requireOwner, async (c) => {
  await disconnectCanva(c.env, c.get("ownerEmail"));
  await logActivity(c.env, "integration.disconnected", c.get("ownerEmail"), "integration", "canva");
  return c.json({ connected: false });
});

const canvaFieldSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(4000) }).strict(),
  z.object({ type: z.literal("video"), asset_id: z.string().trim().min(1).max(200) }).strict(),
]);
const canvaAutofillSchema = z.object({
  brandTemplateId: z.string().trim().min(1).max(200),
  data: z.record(z.string().trim().min(1).max(100), canvaFieldSchema)
    .refine((fields) => Object.keys(fields).length > 0 && Object.keys(fields).length <= 50),
});

app.get("/api/integrations/canva/video-jobs", requireOwner, async (c) => {
  const jobs = await c.env.DB.prepare(
    `SELECT id, status, design_id, export_job_id, created_at, updated_at
     FROM canva_video_jobs WHERE owner_email = ? ORDER BY created_at DESC LIMIT 10`,
  ).bind(c.get("ownerEmail")).all();
  return c.json({ jobs: jobs.results });
});

app.post("/api/integrations/canva/video-jobs", requireOwner, async (c) => {
  const parsed = canvaAutofillSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Provide a Canva brand-template ID and valid video/text field data." }, 400);
  try {
    const autofillJobId = await createCanvaAutofill(
      c.env, c.get("ownerEmail"), parsed.data.brandTemplateId, parsed.data.data,
    );
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO canva_video_jobs (id, owner_email, autofill_job_id, status)
       VALUES (?, ?, ?, 'processing')`,
    ).bind(id, c.get("ownerEmail"), autofillJobId).run();
    await logActivity(c.env, "canva.video_design.started", c.get("ownerEmail"), "canva_video_job", id);
    return c.json({ id, status: "processing" }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Canva video design could not be started." }, 502);
  }
});

app.get("/api/integrations/canva/video-jobs/:id", requireOwner, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id, autofill_job_id, design_id, status FROM canva_video_jobs
     WHERE id = ? AND owner_email = ?`,
  ).bind(c.req.param("id"), c.get("ownerEmail")).first<{
    id: string; autofill_job_id: string; design_id: string | null; status: string;
  }>();
  if (!row) return c.json({ error: "Canva video job not found." }, 404);
  if (row.status === "failed") return c.json({ id: row.id, status: row.status });
  if (row.design_id) return c.json({ id: row.id, status: "ready", designId: row.design_id });
  try {
    const job = await getCanvaAutofill(c.env, c.get("ownerEmail"), row.autofill_job_id);
    if (!job) return c.json({ error: "Canva did not return the requested autofill job." }, 502);
    if (job.status === "failed") {
      await c.env.DB.prepare(
        "UPDATE canva_video_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(row.id).run();
      return c.json({ id: row.id, status: "failed" });
    }
    const designId = job.status === "success" ? job.result?.design?.id : undefined;
    if (job.status === "success" && !designId) {
      return c.json({ error: "Canva completed the template job but did not return a design ID." }, 502);
    }
    if (designId) {
      await c.env.DB.prepare(
        "UPDATE canva_video_jobs SET design_id = ?, status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(designId, row.id).run();
      return c.json({ id: row.id, status: "ready", designId });
    }
    return c.json({ id: row.id, status: "processing" });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Canva video job could not be checked." }, 502);
  }
});

app.post("/api/integrations/canva/video-jobs/:id/export", requireOwner, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT design_id, status FROM canva_video_jobs WHERE id = ? AND owner_email = ?`,
  ).bind(c.req.param("id"), c.get("ownerEmail")).first<{ design_id: string | null; status: string }>();
  if (!row) return c.json({ error: "Canva video job not found." }, 404);
  if (!row.design_id || row.status !== "ready") return c.json({ error: "Wait for Canva to finish the template before exporting." }, 409);
  try {
    const exportJobId = await createCanvaExport(c.env, c.get("ownerEmail"), row.design_id);
    await c.env.DB.prepare(
      `UPDATE canva_video_jobs SET export_job_id = ?, status = 'exporting', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_email = ?`,
    ).bind(exportJobId, c.req.param("id"), c.get("ownerEmail")).run();
    return c.json({ id: c.req.param("id"), status: "exporting" }, 202);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Canva MP4 export could not be started." }, 502);
  }
});

app.get("/api/integrations/canva/video-jobs/:id/export", requireOwner, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT export_job_id, status FROM canva_video_jobs WHERE id = ? AND owner_email = ?`,
  ).bind(c.req.param("id"), c.get("ownerEmail")).first<{ export_job_id: string | null; status: string }>();
  if (!row) return c.json({ error: "Canva video job not found." }, 404);
  if (!row.export_job_id || !["exporting", "complete"].includes(row.status)) {
    return c.json({ error: "Start the MP4 export after the Canva design is ready." }, 409);
  }
  try {
    const job = await getCanvaExport(c.env, c.get("ownerEmail"), row.export_job_id);
    if (!job) return c.json({ error: "Canva did not return the requested export job." }, 502);
    if (job.status === "failed") {
      await c.env.DB.prepare(
        "UPDATE canva_video_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(c.req.param("id")).run();
      return c.json({ id: c.req.param("id"), status: "failed" });
    }
    const urls = job.status === "success" ? (job.result?.urls ?? []) : [];
    const downloadUrls = urls.filter((value) => {
      try { return new URL(value).protocol === "https:"; } catch { return false; }
    });
    if (job.status === "success" && downloadUrls.length === 0) {
      return c.json({ error: "Canva completed the export but did not return an HTTPS download URL." }, 502);
    }
    if (downloadUrls.length) {
      await c.env.DB.prepare(
        "UPDATE canva_video_jobs SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(c.req.param("id")).run();
      return c.json({ id: c.req.param("id"), status: "complete", downloadUrls });
    }
    return c.json({ id: c.req.param("id"), status: "exporting" });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Canva MP4 export could not be checked." }, 502);
  }
});

const generationSchema = z.object({
  brief: z.string().trim().min(10).max(3000),
  pillar: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(160),
  platforms: z.array(z.enum(platforms)).min(1).max(4).refine((value) => new Set(value).size === value.length),
  destinationUrl: z.string().url().refine((value) => value.startsWith("https://"), "Destination must use HTTPS."),
  campaignId: z.string().trim().min(1).max(100).default("manual"),
});

app.post("/api/content/generate", requireOwner, async (c) => {
  const parsed = generationSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid draft request.", details: parsed.error.flatten() }, 400);
  const request = parsed.data;
  const keys = request.platforms.map((platform) => makeIdempotencyKey(request.brief, platform, request.campaignId));
  const existing = await c.env.DB.prepare(
    `SELECT id FROM content_items WHERE idempotency_key IN (${keys.map(() => "?").join(", ")}) LIMIT 1`,
  ).bind(...keys).first<{ id: string }>();
  if (existing) {
    await logActivity(c.env, "content.duplicate_blocked", c.get("ownerEmail"), "content", existing.id);
    return c.json({ error: "A matching content item already exists for this campaign and platform." }, 409);
  }

  let provider: LLMProvider;
  try {
    provider = getProvider(c.env);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "LLM provider setup is invalid." }, 503);
  }
  let reservation: UsageReservation;
  try {
    reservation = await reserveProviderUsage(c.env, c.env.LLM_PROVIDER ?? "mock", JSON.stringify(request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM setup could not be verified.";
    return c.json({ error: message }, message.includes("spend cap") ? 429 : 503);
  }
  let generated: ProviderResult;
  try {
    generated = await provider.generate(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The LLM provider request failed.";
    await logActivity(c.env, "llm.generation_failed", c.get("ownerEmail"), "provider", null, { provider: c.env.LLM_PROVIDER ?? "mock", error: message });
    return c.json({ error: message }, message.includes("setup required") ? 503 : 502);
  }
  validateProviderDrafts(generated.drafts, request.platforms);
  await settleProviderUsage(c.env, reservation, generated);

  const rows: Array<{ id: string; platform: Platform; status: string; qualityFlags: string[] }> = [];
  const settings = await getSettings(c.env);
  const inserts: D1PreparedStatement[] = [];
  for (const draft of generated.drafts) {
    const recent = await c.env.DB.prepare(
      "SELECT hook FROM content_items WHERE platform = ? ORDER BY created_at DESC LIMIT 20",
    ).bind(draft.platform).all<{ hook: string }>();
    const flags = qualityFlags(draft, {
      authorizedPromotionalClaims: settings.authorizedPromotionalClaims,
      destinationUrl: request.destinationUrl,
      recentOpenings: recent.results.map((row) => row.hook),
    });
    const id = crypto.randomUUID();
    const status = flags.length === 0 ? "pending_approval" : "draft";
    const key = makeIdempotencyKey(request.brief, draft.platform, request.campaignId);
    inserts.push(
      c.env.DB.prepare(
        `INSERT INTO content_items (
          id, campaign_id, pillar_id, target_audience, objective, platform, format, hook, message,
          caption_or_script, call_to_action, keywords_json, visual_direction, alt_text,
          source_references_json, status, destination_url, quality_flags_json, measurement_plan_json, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        request.campaignId,
        request.pillar,
        "Business owners and prospective website clients",
        request.objective,
        draft.platform,
        draft.format,
        draft.hook,
        draft.message,
        draft.caption,
        draft.callToAction,
        JSON.stringify(draft.keywords),
        draft.visualDirection,
        draft.altText ?? "",
        JSON.stringify(draft.sourceReferences),
        status,
        request.destinationUrl,
        JSON.stringify(flags),
        JSON.stringify({ primary: "qualified enquiries", source: "UTM link; live analytics not connected" }),
        key,
      ),
    );
    rows.push({ id, platform: draft.platform, status, qualityFlags: flags });
  }
  try {
    await c.env.DB.batch(inserts);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      await logActivity(c.env, "content.duplicate_blocked", c.get("ownerEmail"), "content", null);
      return c.json({ error: "A matching content item already exists for this campaign and platform." }, 409);
    }
    throw error;
  }
  for (const row of rows) {
    const status = row.status;
    if (status === "pending_approval") {
      await logActivity(c.env, "content.pending_approval", c.get("ownerEmail"), "content", row.id, { platform: row.platform });
    } else {
      await logActivity(c.env, "content.quality_flagged", c.get("ownerEmail"), "content", row.id, { flags: row.qualityFlags });
    }
  }
  return c.json({ drafts: rows, provider: generated.provider, liveGeneration: generated.provider !== "mock" }, 201);
});

app.get("/api/content", async (c) => {
  const items = await c.env.DB.prepare(
    `SELECT id, platform, format, hook, message, caption_or_script, call_to_action, status,
     destination_url, quality_flags_json, visual_direction, alt_text, planned_at, created_at,
     linkedin_post_id, linkedin_publications.status AS linkedin_publication_status
     FROM content_items LEFT JOIN linkedin_publications ON linkedin_publications.content_id = content_items.id
     ORDER BY content_items.created_at DESC LIMIT 100`,
  ).all();
  return c.json({ items: items.results });
});

app.post("/api/content/:id/publish/linkedin", requireOwner, requireSameOrigin, async (c) => {
  const id = c.req.param("id");
  const item = await c.env.DB.prepare(
    `SELECT status, platform, caption_or_script, call_to_action, destination_url, quality_flags_json
     FROM content_items WHERE id = ?`,
  ).bind(id).first<{
    status: ContentStatus;
    platform: Platform;
    caption_or_script: string;
    call_to_action: string;
    destination_url: string;
    quality_flags_json: string;
  }>();
  if (!item) return c.json({ error: "Content item not found." }, 404);
  if (item.platform !== "linkedin") return c.json({ error: "Only LinkedIn content can be published through this integration." }, 400);
  const previous = await c.env.DB.prepare(
    "SELECT status, post_id, updated_at FROM linkedin_publications WHERE content_id = ?",
  ).bind(id).first<{ status: string; post_id: string | null; updated_at: string }>();
  if (previous?.status === "published") {
    return c.json({ id, status: "published", postId: previous.post_id, alreadyPublished: true });
  }
  if (item.status !== "approved") return c.json({ error: "Approve this content before publishing it to LinkedIn." }, 409);
  if (JSON.parse(item.quality_flags_json).length > 0) return c.json({ error: "Resolve all quality flags before publishing." }, 409);
  if (!isActionAllowed(await getSettings(c.env), "publish", true)) {
    return c.json({ error: "Publishing is blocked by the emergency pause or approval policy." }, 403);
  }
  const connection = await getLinkedInConnection(c.env, c.get("ownerEmail"));
  if (!connection.configured || !connection.connected) {
    return c.json({ error: connection.error ?? "Connect LinkedIn before publishing." }, 503);
  }
  const locked = await c.env.DB.prepare(
    `UPDATE content_items SET linkedin_publish_locked = 1
     WHERE id = ? AND status = 'approved' AND linkedin_publish_locked = 0`,
  ).bind(id).run();
  if (locked.meta.changes !== 1) {
    return c.json({ error: "This content is already being published or its state changed. Reload and check its status." }, 409);
  }
  if (previous?.status === "unknown") {
    return c.json({ error: "The LinkedIn result is uncertain. Check your feed and resolve the attempt before retrying." }, 409);
  }
  if (previous?.status === "submitting" && Date.parse(previous.updated_at) > Date.now() - 5 * 60_000) {
    return c.json({ error: "A LinkedIn publish request is already in progress. Wait before retrying." }, 409);
  }
  if (previous?.status === "submitting") {
    await c.env.DB.prepare(
      `UPDATE linkedin_publications SET status = 'unknown',
       error_message = 'The previous request stopped before its result was confirmed.',
       updated_at = CURRENT_TIMESTAMP WHERE content_id = ? AND status = 'submitting'`,
    ).bind(id).run();
    return c.json({ error: "The previous LinkedIn request may have completed. Check your feed and resolve the attempt before retrying." }, 409);
  }

  if (previous?.status === "failed") {
    const retry = await c.env.DB.prepare(
      `UPDATE linkedin_publications SET status = 'submitting', error_message = NULL,
       attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
       WHERE content_id = ? AND status = 'failed'`,
    ).bind(id).run();
    if (retry.meta.changes !== 1) return c.json({ error: "The publish attempt changed concurrently; reload and retry." }, 409);
  } else {
    const attempt = await c.env.DB.prepare(
      `INSERT INTO linkedin_publications (content_id, owner_email, status)
       VALUES (?, ?, 'submitting') ON CONFLICT(content_id) DO NOTHING`,
    ).bind(id, c.get("ownerEmail")).run();
    if (attempt.meta.changes !== 1) return c.json({ error: "A LinkedIn publish attempt already exists; reload and check its status." }, 409);
  }

  const commentary = [
    item.caption_or_script.trim(),
    item.call_to_action.trim(),
    buildUtmUrl(item.destination_url, "linkedin", "nearly-social", id),
  ].filter(Boolean).join("\n\n");
  let postId: string;
  try {
    postId = await publishLinkedInTextPost(c.env, c.get("ownerEmail"), commentary);
  } catch (error) {
    const outcome = error instanceof LinkedInApiError ? error.outcome : "failed";
    const message = error instanceof Error ? error.message : "LinkedIn publishing failed.";
    await c.env.DB.prepare(
      `UPDATE linkedin_publications SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
       WHERE content_id = ? AND status = 'submitting'`,
    ).bind(outcome, message, id).run();
    if (outcome === "failed") {
      await c.env.DB.prepare(
        "UPDATE content_items SET linkedin_publish_locked = 0 WHERE id = ? AND status = 'approved'",
      ).bind(id).run();
    }
    await logActivity(
      c.env,
      outcome === "unknown" ? "linkedin.publish_outcome_unknown" : "linkedin.publish_failed",
      c.get("ownerEmail"),
      "content",
      id,
      { error: message },
    );
    return c.json({ error: message, status: outcome }, outcome === "unknown" ? 502 : 503);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE linkedin_publications SET status = 'published', post_id = ?, error_message = NULL,
       published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE content_id = ? AND status = 'submitting'`,
    ).bind(postId, id),
    c.env.DB.prepare(
      `UPDATE content_items SET status = 'published', linkedin_post_id = ?, linkedin_publish_locked = 0,
       updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved' AND linkedin_publish_locked = 1`,
    ).bind(postId, id),
  ]);
  await logActivity(c.env, "linkedin.post_published", c.get("ownerEmail"), "content", id, { postId });
  return c.json({ id, status: "published", postId }, 201);
});

app.post("/api/content/:id/linkedin/resolve", requireOwner, requireSameOrigin, async (c) => {
  const parsed = z.object({
    outcome: z.enum(["published", "not_published"]),
    postId: z.string().trim().min(1).max(300).optional(),
  }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Choose whether the LinkedIn post was published and provide a post ID if available." }, 400);
  const id = c.req.param("id");
  const attempt = await c.env.DB.prepare(
    "SELECT status FROM linkedin_publications WHERE content_id = ? AND owner_email = ?",
  ).bind(id, c.get("ownerEmail")).first<{ status: string }>();
  if (!attempt || attempt.status !== "unknown") {
    return c.json({ error: "There is no uncertain LinkedIn attempt to resolve." }, 409);
  }
  if (parsed.data.outcome === "published") {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE linkedin_publications SET status = 'published', post_id = ?, error_message = NULL,
         published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE content_id = ? AND status = 'unknown'`,
      ).bind(parsed.data.postId ?? null, id),
      c.env.DB.prepare(
        `UPDATE content_items SET status = 'published', linkedin_post_id = ?, linkedin_publish_locked = 0,
         updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'approved' AND linkedin_publish_locked = 1`,
      ).bind(parsed.data.postId ?? null, id),
    ]);
  } else {
    await c.env.DB.prepare(
      `UPDATE linkedin_publications SET status = 'failed',
       error_message = 'Owner confirmed that LinkedIn did not create the post.',
       updated_at = CURRENT_TIMESTAMP WHERE content_id = ? AND status = 'unknown'`,
    ).bind(id).run();
    await c.env.DB.prepare(
      "UPDATE content_items SET linkedin_publish_locked = 0 WHERE id = ? AND status = 'approved'",
    ).bind(id).run();
  }
  await logActivity(
    c.env,
    parsed.data.outcome === "published" ? "linkedin.publish_reconciled_published" : "linkedin.publish_reconciled_not_published",
    c.get("ownerEmail"),
    "content",
    id,
    { postId: parsed.data.postId ?? null },
  );
  return c.json({ id, status: parsed.data.outcome });
});

const transitionSchema = z.object({
  to: z.enum(["draft", "pending_approval", "approved", "rejected", "scheduled", "cancelled", "published"]),
  note: z.string().max(1000).optional(),
  plannedAt: z.string().datetime().optional(),
  livePostUrl: z.string().url().optional(),
});

type TransitionInput = Omit<z.infer<typeof transitionSchema>, "to">;

async function moveContent(env: Env, id: string, target: ContentStatus, owner: string, input: TransitionInput) {
  const item = await env.DB.prepare(
    "SELECT status, platform, call_to_action, caption_or_script, destination_url, visual_direction, alt_text, quality_flags_json FROM content_items WHERE id = ?",
  ).bind(id).first<{
    status: ContentStatus;
    quality_flags_json: string;
    platform: Platform;
    call_to_action: string;
    caption_or_script: string;
    destination_url: string;
    visual_direction: string;
    alt_text: string;
  }>();
  if (!item) return { error: "Content item not found.", status: 404 as const };
  if (item.platform === "linkedin") {
    const attempt = await env.DB.prepare(
      "SELECT status FROM linkedin_publications WHERE content_id = ?",
    ).bind(id).first<{ status: string }>();
    if (attempt && ["submitting", "unknown"].includes(attempt.status)) {
      return { error: "Resolve the outstanding LinkedIn publish attempt before changing this content.", status: 409 as const };
    }
  }
  if (target === "exported" && item.status === "exported") {
    if (!isActionAllowed(await getSettings(env), "export", true)) {
      return { error: "Export or publishing is blocked by the approval policy or emergency pause.", status: 403 as const };
    }
    return {
      status: 200 as const,
      package: {
        caption: item.caption_or_script,
        altText: item.alt_text || "[Add alt text after the actual media asset is created.]",
        utmLink: buildUtmUrl(item.destination_url, item.platform, "nearly-social", id),
        assetBrief: item.visual_direction || "[No asset brief has been supplied.]",
        platform: item.platform,
      },
    };
  }
  if (!canTransition(item.status, target)) {
    await logActivity(env, "content.invalid_transition", owner, "content", id, { from: item.status, to: target });
    return { error: `Invalid content transition: ${item.status} -> ${target}.`, status: 409 as const };
  }
  if (target === "pending_approval" && JSON.parse(item.quality_flags_json).length > 0) {
    return { error: "Resolve all quality flags before submitting this draft for approval.", status: 409 as const };
  }
  if (target === "scheduled" && !input.plannedAt) {
    return { error: "Set a publication time before scheduling this content.", status: 400 as const };
  }
  if ((target === "exported" || target === "published") && !isActionAllowed(await getSettings(env), target === "exported" ? "export" : "publish", item.status === "approved" || item.status === "scheduled" || item.status === "exported")) {
    return { error: "Export or publishing is blocked by the approval policy or emergency pause.", status: 403 as const };
  }
  if (target === "published" && (!input.livePostUrl || !input.livePostUrl.startsWith("https://"))) {
    return { error: "Confirm publication with the HTTPS URL of the live post.", status: 400 as const };
  }
  const updated = await env.DB.prepare(
    `UPDATE content_items SET status = ?, planned_at = COALESCE(?, planned_at),
      live_post_url = COALESCE(?, live_post_url), updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = ? AND linkedin_publish_locked = 0`,
  ).bind(target, input.plannedAt ?? null, input.livePostUrl ?? null, id, item.status).run();
  if (updated.meta.changes !== 1) return { error: "Content changed concurrently; reload and retry.", status: 409 as const };

  if (target === "approved" || target === "rejected") {
    await env.DB.prepare(
      "INSERT INTO approvals (id, content_id, decision, owner_email, note) VALUES (?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), id, target, owner, input.note ?? "").run();
  }
  await logActivity(env, `content.${target}`, owner, "content", id, { note: input.note ?? "" });

  if (target === "exported") {
    return {
      status: 200 as const,
      package: {
        caption: item.caption_or_script,
        altText: item.alt_text || "[Add alt text after the actual media asset is created.]",
        utmLink: buildUtmUrl(item.destination_url, item.platform, "nearly-social", id),
        assetBrief: item.visual_direction || "[No asset brief has been supplied.]",
        platform: item.platform,
      },
    };
  }
  return { status: 200 as const, contentId: id, state: target };
}

app.post("/api/content/:id/transition", requireOwner, async (c) => {
  const parsed = transitionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid transition request.", details: parsed.error.flatten() }, 400);
  const result = await moveContent(c.env, c.req.param("id"), parsed.data.to, c.get("ownerEmail"), parsed.data);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json(result);
});

app.post("/api/content/:id/export", requireOwner, async (c) => {
  const result = await moveContent(c.env, c.req.param("id"), "exported", c.get("ownerEmail"), {});
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json(result);
});

app.get("/api/activity", async (c) => {
  const items = await c.env.DB.prepare(
    "SELECT id, event_type, actor, entity_type, entity_id, details_json, created_at FROM activity_log ORDER BY created_at DESC LIMIT 100",
  ).all();
  return c.json({ items: items.results });
});

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const settings = await getSettings(env);
    if (!settings.paused) {
      const slot = Math.floor(Date.now() / (15 * 60 * 1000));
      await env.DB.prepare(
        `INSERT INTO jobs (id, name, idempotency_key)
         VALUES (?, 'heartbeat', ?)
         ON CONFLICT(idempotency_key) DO NOTHING`,
      ).bind(crypto.randomUUID(), `heartbeat:${slot}`).run();
    }
    await runScheduledJobs(env);
  },
};

export { app };
