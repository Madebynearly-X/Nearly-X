import { describe, expect, it } from "vitest";
import { hasLocalAuthBypass, requireAccess } from "../src/security/auth";
import type { AppEnv, Env } from "../src/env";
import { Hono } from "hono";
import { env } from "cloudflare:workers";

const app = new Hono<AppEnv>();
app.use("*", requireAccess);
app.get("/api/protected", (c) => c.json({ ok: true }));

describe("Cloudflare Access authentication", () => {
  it("only enables the local bypass in explicit development mode", () => {
    expect(hasLocalAuthBypass({ ...env, ENVIRONMENT: "development", ALLOW_DEV_AUTH_BYPASS: "true" })).toBe(true);
    expect(hasLocalAuthBypass({ ...env, ENVIRONMENT: "production", ALLOW_DEV_AUTH_BYPASS: "true" })).toBe(false);
    expect(hasLocalAuthBypass({ ...env, ENVIRONMENT: "development", ALLOW_DEV_AUTH_BYPASS: "1" })).toBe(false);
  });

  it("fails closed with a setup status in production and rejects missing local tokens", async () => {
    const production = { ...env, ENVIRONMENT: "production", ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } as Env;
    const productionResponse = await app.request("/api/protected", {}, production);
    expect(productionResponse.status).toBe(503);
    const local = { ...env, ENVIRONMENT: "development", ALLOW_DEV_AUTH_BYPASS: "false" } as Env;
    const localResponse = await app.request("/api/protected", {}, local);
    expect(localResponse.status).toBe(401);
  });
});
