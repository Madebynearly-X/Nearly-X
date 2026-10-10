import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { app } from "../src/index";
import type { Env } from "../src/env";

const ownerEmail = "linkedin-owner@test.local";
const ownerEnv = {
  ...env,
  ENVIRONMENT: "development",
  ALLOW_DEV_AUTH_BYPASS: "true",
  OWNER_EMAIL: ownerEmail,
  LINKEDIN_CLIENT_ID: "linkedin-client",
  LINKEDIN_CLIENT_SECRET: "linkedin-client-secret",
  LINKEDIN_REDIRECT_URI: "https://agent.example.com/api/integrations/linkedin/callback",
  LINKEDIN_TOKEN_ENCRYPTION_KEY: "A".repeat(43),
  LINKEDIN_API_VERSION: "202609",
} as Env;

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders,
  });
}

async function connectLinkedIn(mockFetch: ReturnType<typeof vi.fn<typeof fetch>>): Promise<void> {
  mockFetch
    .mockResolvedValueOnce(jsonResponse({ access_token: "linkedin-access-secret", expires_in: 3600 }))
    .mockResolvedValueOnce(jsonResponse({ sub: "member-id-123" }));
  const connect = await app.request("/api/integrations/linkedin/connect", {
    method: "POST",
    headers: { Origin: "http://localhost" },
    body: "{}",
  }, ownerEnv);
  expect(connect.status).toBe(200);
  const { authorizationUrl } = await connect.json() as { authorizationUrl: string };
  const authorization = new URL(authorizationUrl);
  expect(authorization.origin).toBe("https://www.linkedin.com");
  expect(authorization.searchParams.get("scope")?.split(" ").sort()).toEqual(["openid", "profile", "w_member_social"]);
  const callback = await app.request(
    `/api/integrations/linkedin/callback?code=one-time-code&state=${encodeURIComponent(authorization.searchParams.get("state") ?? "")}`,
    {},
    ownerEnv,
  );
  expect(callback.status).toBe(302);
  expect(callback.headers.get("Location")).toContain("linkedin-connected");
}

async function createApprovedContent(): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO content_items (
      id, objective, platform, format, hook, message, caption_or_script, call_to_action,
      status, destination_url, idempotency_key
    ) VALUES (?, 'qualified enquiries', 'linkedin', 'text', 'Hook', 'Message',
      'A useful post for business owners.', 'Explore the website.',
      'approved', 'https://nearly-x.pages.dev/', ?)`,
  ).bind(id, `linkedin-publish:${id}`).run();
  return id;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await env.DB.prepare("DELETE FROM linkedin_publications WHERE owner_email = ?").bind(ownerEmail).run();
  await env.DB.prepare("DELETE FROM linkedin_connections WHERE owner_email = ?").bind(ownerEmail).run();
  await env.DB.prepare("DELETE FROM linkedin_oauth_states WHERE owner_email = ?").bind(ownerEmail).run();
});

describe("LinkedIn text publishing", () => {
  it("connects with OAuth, encrypts the token, and publishes an approved member post", async () => {
    const mockFetch = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", mockFetch);
    let id: string | undefined;
    try {
      await connectLinkedIn(mockFetch);
      const storedToken = await env.DB.prepare(
        "SELECT token_ciphertext FROM linkedin_connections WHERE id = 1",
      ).first<{ token_ciphertext: string }>();
      expect(storedToken?.token_ciphertext).not.toContain("linkedin-access-secret");

      id = await createApprovedContent();
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 201, { "x-restli-id": "urn:li:share:post-123" }));
      const response = await app.request(`/api/content/${id}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: "{}",
      }, ownerEnv);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ id, status: "published", postId: "urn:li:share:post-123" });

      const request = mockFetch.mock.calls[2];
      expect(request[0]).toBe("https://api.linkedin.com/rest/posts");
      const headers = new Headers(request[1]?.headers);
      expect(headers.get("Authorization")).toBe("Bearer linkedin-access-secret");
      expect(headers.get("LinkedIn-Version")).toBe("202609");
      expect(headers.get("X-Restli-Protocol-Version")).toBe("2.0.0");
      const body = JSON.parse(String(request[1]?.body)) as Record<string, unknown>;
      expect(body.author).toBe("urn:li:person:member-id-123");
      expect(body.lifecycleState).toBe("PUBLISHED");
      expect(body.commentary).toContain("A useful post for business owners.");
      expect(body.commentary).toContain("utm_source=linkedin");

      const item = await env.DB.prepare(
        "SELECT status, linkedin_post_id FROM content_items WHERE id = ?",
      ).bind(id).first<{ status: string; linkedin_post_id: string }>();
      expect(item).toEqual({ status: "published", linkedin_post_id: "urn:li:share:post-123" });

      const duplicate = await app.request(`/api/content/${id}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: "{}",
      }, ownerEnv);
      expect(duplicate.status).toBe(200);
      expect(await duplicate.json()).toEqual({
        id,
        status: "published",
        postId: "urn:li:share:post-123",
        alreadyPublished: true,
      });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    } finally {
      if (id) await env.DB.prepare("DELETE FROM content_items WHERE id = ?").bind(id).run();
    }
  });

  it("does not retry an uncertain network result until the owner resolves it", async () => {
    const mockFetch = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", mockFetch);
    let id: string | undefined;
    try {
      await connectLinkedIn(mockFetch);
      id = await createApprovedContent();
      mockFetch.mockRejectedValueOnce(new Error("simulated network interruption"));
      const failedRequest = await app.request(`/api/content/${id}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: "{}",
      }, ownerEnv);
      expect(failedRequest.status).toBe(502);
      expect(await failedRequest.json()).toMatchObject({ status: "unknown" });

      const blockedRetry = await app.request(`/api/content/${id}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: "{}",
      }, ownerEnv);
      expect(blockedRetry.status).toBe(409);

      const resolved = await app.request(`/api/content/${id}/linkedin/resolve`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: JSON.stringify({ outcome: "not_published" }),
      }, ownerEnv);
      expect(resolved.status).toBe(200);

      mockFetch.mockResolvedValueOnce(jsonResponse({}, 201, { "x-restli-id": "urn:li:share:post-after-reconcile" }));
      const retried = await app.request(`/api/content/${id}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: "{}",
      }, ownerEnv);
      expect(retried.status).toBe(201);
    } finally {
      if (id) await env.DB.prepare("DELETE FROM content_items WHERE id = ?").bind(id).run();
    }
  });

  it("requires owner approval and respects emergency pause before publishing", async () => {
    const draftId = await createApprovedContent();
    const deniedId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO content_items (
        id, objective, platform, format, hook, message, caption_or_script, call_to_action,
        destination_url, idempotency_key
      ) VALUES (?, 'awareness', 'linkedin', 'text', 'Hook', 'Message', 'Caption', 'Contact us',
        'https://nearly-x.pages.dev/', ?)`,
    ).bind(deniedId, `linkedin-draft:${deniedId}`).run();
    const original = await env.DB.prepare("SELECT paused FROM settings WHERE id = 1").first<{ paused: number }>();
    try {
      const unapproved = await app.request(`/api/content/${deniedId}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: "{}",
      }, ownerEnv);
      expect(unapproved.status).toBe(409);

      await env.DB.prepare("UPDATE settings SET paused = 1 WHERE id = 1").run();
      const paused = await app.request(`/api/content/${draftId}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "http://localhost" },
        body: "{}",
      }, ownerEnv);
      expect(paused.status).toBe(403);
    } finally {
      await env.DB.prepare("UPDATE settings SET paused = ? WHERE id = 1").bind(original?.paused ?? 0).run();
      await env.DB.prepare("DELETE FROM content_items WHERE id IN (?, ?)").bind(draftId, deniedId).run();
    }
  });

  it("rejects cross-origin publish requests", async () => {
    const id = await createApprovedContent();
    try {
      const response = await app.request(`/api/content/${id}/publish/linkedin`, {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
        body: "{}",
      }, ownerEnv);
      expect(response.status).toBe(403);
      expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM linkedin_publications WHERE content_id = ?")
        .bind(id).first<{ count: number }>()).toEqual({ count: 0 });
    } finally {
      await env.DB.prepare("DELETE FROM content_items WHERE id = ?").bind(id).run();
    }
  });
});
