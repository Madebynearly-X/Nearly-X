import { createRemoteJWKSet, jwtVerify } from "jose";
import { createMiddleware } from "hono/factory";
import type { AppEnv, Env } from "../env";

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function hasLocalAuthBypass(env: Env): boolean {
  return env.ENVIRONMENT === "development" && env.ALLOW_DEV_AUTH_BYPASS === "true";
}

function accessConfig(env: Env): { teamDomain: string; audience: string } | null {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim().replace(/^https:\/\//, "").replace(/\/+$/, "");
  const audience = env.ACCESS_AUD?.trim();
  if (!teamDomain || !audience || !/^[a-z0-9.-]+$/i.test(teamDomain)) return null;
  return { teamDomain, audience };
}

export const requireAccess = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.path === "/api/health") return next();
  if (hasLocalAuthBypass(c.env)) {
    c.set("ownerEmail", c.env.OWNER_EMAIL?.trim().toLowerCase() ?? "local-development");
    return next();
  }

  const config = accessConfig(c.env);
  if (!config) {
    if (c.env.ENVIRONMENT === "production") {
      return c.json({ error: "Authentication setup is required before production use." }, 503);
    }
    return c.json({ error: "Cloudflare Access authentication is not configured." }, 401);
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) return c.json({ error: "Cloudflare Access authentication is required." }, 401);

  try {
    let jwks = jwksCache.get(config.teamDomain);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`https://${config.teamDomain}/cdn-cgi/access/certs`));
      jwksCache.set(config.teamDomain, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, {
      audience: config.audience,
      issuer: `https://${config.teamDomain}`,
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) return c.json({ error: "The Access identity does not contain an email address." }, 401);
    c.set("ownerEmail", email);
    return next();
  } catch {
    return c.json({ error: "Cloudflare Access authentication could not be verified." }, 401);
  }
});

export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  const configuredOwner = c.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!configuredOwner) {
    return c.json({ error: "Owner identity is not configured." }, 503);
  }
  if (c.get("ownerEmail") !== configuredOwner) {
    return c.json({ error: "Only the configured owner can change this setting." }, 403);
  }
  return next();
});
