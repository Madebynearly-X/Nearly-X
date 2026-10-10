import { describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { app } from "../src/index";
import type { Env } from "../src/env";

const ownerEnv = {
  ...env,
  ENVIRONMENT: "development",
  ALLOW_DEV_AUTH_BYPASS: "true",
  OWNER_EMAIL: "owner@test.local",
  CANVA_CLIENT_ID: "canva-test-client",
  CANVA_CLIENT_SECRET: "canva-test-secret",
  CANVA_REDIRECT_URI: "http://localhost:8787/api/integrations/canva/callback",
  CANVA_TOKEN_ENCRYPTION_KEY: "test-key-material-for-token-encryption-0123456789ABCDEF",
} as Env;

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
}

describe("Canva video integration", () => {
  it("authorizes securely, creates a template design, and exports an MP4", async () => {
    const mockFetch = vi.fn<typeof fetch>();
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ access_token: "canva-access-secret", refresh_token: "canva-refresh-secret", expires_in: 1 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: "canva-refreshed-access-secret", refresh_token: "canva-rotated-refresh-secret", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: "autofill-job-1" } }))
      .mockResolvedValueOnce(jsonResponse({ job: { status: "success", result: { design: { id: "design-1" } } } }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: "export-job-1" } }))
      .mockResolvedValueOnce(jsonResponse({ job: { status: "success", result: { urls: ["https://download.canva.com/video.mp4"] } } }));
    vi.stubGlobal("fetch", mockFetch);

    try {
      const connectResponse = await app.request("/api/integrations/canva/connect", { method: "POST", body: "{}" }, ownerEnv);
      expect(connectResponse.status).toBe(200);
      const { authorizationUrl } = await connectResponse.json() as { authorizationUrl: string };
      const authorize = new URL(authorizationUrl);
      expect(authorize.origin).toBe("https://www.canva.com");
      expect(authorize.searchParams.get("code_challenge_method")).toBe("s256");
      expect(authorize.searchParams.get("scope")).toContain("design:content:write");

      const callback = await app.request(
        `/api/integrations/canva/callback?code=one-time-code&state=${encodeURIComponent(authorize.searchParams.get("state") ?? "")}`,
        {},
        ownerEnv,
      );
      expect(callback.status).toBe(302);
      expect(callback.headers.get("Location")).toContain("canva-connected");
      const replay = await app.request(
        `/api/integrations/canva/callback?code=one-time-code&state=${encodeURIComponent(authorize.searchParams.get("state") ?? "")}`,
        {},
        ownerEnv,
      );
      expect(replay.headers.get("Location")).toContain("canva-error");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const savedToken = await env.DB.prepare(
        "SELECT token_iv, token_ciphertext FROM integration_connections WHERE provider = 'canva'",
      ).first<{ token_iv: string; token_ciphertext: string }>();
      expect(savedToken?.token_ciphertext).not.toContain("canva-access-secret");
      expect(savedToken?.token_ciphertext).not.toContain("canva-refresh-secret");

      const start = await app.request("/api/integrations/canva/video-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandTemplateId: "brand-template-1",
          data: {
            headline: { type: "text", text: "A clear video headline" },
            video: { type: "video", asset_id: "canva-video-asset-1" },
          },
        }),
      }, ownerEnv);
      expect(start.status).toBe(201);
      const created = await start.json() as { id: string; status: string };
      expect(created.status).toBe("processing");

      const design = await app.request(`/api/integrations/canva/video-jobs/${created.id}`, {}, ownerEnv);
      expect(await design.json()).toEqual({ id: created.id, status: "ready", designId: "design-1" });

      const exportStart = await app.request(`/api/integrations/canva/video-jobs/${created.id}/export`, {
        method: "POST",
        body: "{}",
      }, ownerEnv);
      expect(exportStart.status).toBe(202);

      const exported = await app.request(`/api/integrations/canva/video-jobs/${created.id}/export`, {}, ownerEnv);
      expect(await exported.json()).toEqual({
        id: created.id,
        status: "complete",
        downloadUrls: ["https://download.canva.com/video.mp4"],
      });

      expect(mockFetch).toHaveBeenCalledTimes(6);
      expect(mockFetch.mock.calls[1][0]).toBe("https://api.canva.com/rest/v1/oauth/token");
      expect(new URLSearchParams(String(mockFetch.mock.calls[1][1]?.body)).get("grant_type")).toBe("refresh_token");
      expect(mockFetch.mock.calls[2][0]).toBe("https://api.canva.com/rest/v1/autofills");
      expect(new Headers(mockFetch.mock.calls[2][1]?.headers).get("Authorization")).toBe("Bearer canva-refreshed-access-secret");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
