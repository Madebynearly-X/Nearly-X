import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { app } from "../src/index";
import type { Env } from "../src/env";
import { getSettings } from "../src/db/settings";

const localEnv = { ...env, ENVIRONMENT: "development", ALLOW_DEV_AUTH_BYPASS: "true", OWNER_EMAIL: "owner@test.local" } as Env;

describe("protected application routes", () => {
  it("serves only a minimal unauthenticated health response", async () => {
    const response = await app.request("/api/health", {}, { ...localEnv, ENVIRONMENT: "production", ALLOW_DEV_AUTH_BYPASS: "false" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("lists Canva and Adobe Express as unconnected video creation tools", async () => {
    const response = await app.request("/api/integrations", {}, localEnv);
    const body = await response.json() as { capabilities: { platform: string; category: string; connection: string; verification: string }[] };
    const videoTools = body.capabilities.filter((item) => item.category === "Video creation");

    expect(response.status).toBe(200);
    expect(videoTools.map((item) => item.platform)).toEqual(["Canva", "Adobe Express"]);
    expect(videoTools.find((item) => item.platform === "Canva")?.connection).toBe("Not connected");
    expect(videoTools.find((item) => item.platform === "Adobe Express")?.connection).toBe("Awaiting approval");
    expect(videoTools.every((item) => item.verification === "unverified")).toBe(true);
  });

  it("does not enable video providers until their account prerequisites are configured", async () => {
    const response = await app.request("/api/integrations", {}, localEnv);
    const body = await response.json() as {
      canva: { configured: boolean; connected: boolean };
      linkedin: { configured: boolean; connected: boolean; error: string | null };
      adobeExpress: { available: boolean; clientId: string | null };
      capabilities: { platform: string; connection: string; verification: string; sourceUrl: string | null }[];
    };
    expect(body.canva).toEqual(expect.objectContaining({ configured: false, connected: false }));
    expect(body.linkedin).toEqual({
      configured: false,
      connected: false,
      connectedAt: null,
      expiresAt: null,
      error: "LinkedIn setup required: configure LINKEDIN_CLIENT_ID as a Worker secret or variable.",
    });
    expect(body.adobeExpress).toEqual({ available: false, clientId: null, appName: "NEARLY Studio" });
    expect(body.capabilities.find((item) => item.platform === "Adobe Express")?.connection).toBe("Awaiting approval");
    expect(body.capabilities.find((item) => item.platform === "LinkedIn")).toEqual(expect.objectContaining({
      connection: "Not connected",
      verification: "official-docs-checked",
      sourceUrl: expect.stringContaining("linkedin/marketing/community-management/shares/posts-api"),
    }));
  });

  it("only enables Adobe Express on the approved HTTPS origin", async () => {
    const approvedEnv = {
      ...localEnv,
      ADOBE_EXPRESS_EMBED_APPROVED: "true",
      ADOBE_EXPRESS_EMBED_CLIENT_ID: "public-embed-client",
      APP_PUBLIC_ORIGIN: "https://agent.example.com",
    };
    const secure = await app.request("https://agent.example.com/api/integrations", {}, approvedEnv);
    const secureBody = await secure.json() as { adobeExpress: { available: boolean; clientId: string | null } };
    expect(secureBody.adobeExpress).toEqual({ available: true, clientId: "public-embed-client", appName: "NEARLY Studio" });

    const insecure = await app.request("http://agent.example.com/api/integrations", {}, approvedEnv);
    const insecureBody = await insecure.json() as { adobeExpress: { available: boolean; clientId: string | null } };
    expect(insecureBody.adobeExpress).toEqual({ available: false, clientId: null, appName: "NEARLY Studio" });
  });

  it("fails Canva connection attempts with an explicit setup message when credentials are missing", async () => {
    const response = await app.request("/api/integrations/canva/connect", { method: "POST", body: "{}" }, localEnv);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Canva setup required: configure CANVA_CLIENT_ID as a Worker secret or variable.",
    });
  });

  it("rejects invalid Canva template data before contacting Canva", async () => {
    const response = await app.request("/api/integrations/canva/video-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandTemplateId: "template-1", data: { clip: { type: "video", url: "https://example.com/video.mp4" } } }),
    }, localEnv);
    expect(response.status).toBe(400);
  });

  it("does not allow an unapproved draft to be exported", async () => {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO content_items (
        id, objective, platform, format, hook, message, caption_or_script, call_to_action,
        destination_url, idempotency_key
      ) VALUES (?, 'awareness', 'instagram', 'text', 'Hook', 'Message', 'Caption', 'Contact us',
        'https://nearly-x.pages.dev/', ?)`,
    ).bind(id, `route-draft:${id}`).run();
    const response = await app.request(`/api/content/${id}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }, localEnv);
    expect(response.status).toBe(409);
  });

  it("blocks export of approved content while paused", async () => {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO content_items (
        id, objective, platform, format, hook, message, caption_or_script, call_to_action,
        status, destination_url, idempotency_key
      ) VALUES (?, 'awareness', 'instagram', 'text', 'Hook', 'Message', 'Caption', 'Contact us',
        'approved', 'https://nearly-x.pages.dev/', ?)`,
    ).bind(id, `paused-export:${id}`).run();
    const original = await getSettings(env);
    await env.DB.prepare("UPDATE settings SET paused = 1 WHERE id = 1").run();
    try {
      const response = await app.request(`/api/content/${id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }, localEnv);
      expect(response.status).toBe(403);
    } finally {
      await env.DB.prepare("UPDATE settings SET paused = ? WHERE id = 1").bind(original.paused ? 1 : 0).run();
    }
  });
});
