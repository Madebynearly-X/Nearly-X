const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const ACCESS_KEYS_CACHE_MS = 5 * 60 * 1000;
let accessKeysCache = null;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getAccessKeys(teamDomain, forceRefresh = false) {
  if (
    !forceRefresh
    && accessKeysCache
    && accessKeysCache.teamDomain === teamDomain
    && Date.now() - accessKeysCache.fetchedAt < ACCESS_KEYS_CACHE_MS
  ) {
    return accessKeysCache.keys;
  }

  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Cloudflare Access certificates returned ${response.status}.`);
  }

  const result = await response.json();
  if (!result || !Array.isArray(result.keys)) {
    throw new Error("Cloudflare Access returned an invalid certificate set.");
  }

  accessKeysCache = { teamDomain, fetchedAt: Date.now(), keys: result.keys };
  return accessKeysCache.keys;
}

async function hasValidAccessToken(request, teamDomain, audience) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  let header;
  let claims;
  let signature;
  try {
    header = decodeJwtPart(parts[0]);
    claims = decodeJwtPart(parts[1]);
    signature = decodeBase64Url(parts[2]);
  } catch {
    return false;
  }

  if (!header || header.alg !== "RS256" || typeof header.kid !== "string") return false;
  if (!claims || typeof claims !== "object") return false;
  const issuer = `https://${teamDomain}`;
  const audiences = typeof claims.aud === "string"
    ? [claims.aud]
    : Array.isArray(claims.aud) && claims.aud.every((value) => typeof value === "string")
      ? claims.aud
      : [];
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== issuer
    || !audiences.includes(audience)
    || typeof claims.exp !== "number"
    || !Number.isFinite(claims.exp)
    || claims.exp <= now
    || (claims.nbf !== undefined && (
      typeof claims.nbf !== "number"
      || !Number.isFinite(claims.nbf)
      || claims.nbf > now + 60
    ))
  ) {
    return false;
  }

  let keys = await getAccessKeys(teamDomain);
  let keyData = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!keyData) {
    keys = await getAccessKeys(teamDomain, true);
    keyData = keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  }
  if (!keyData) return false;

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signedContent);
}

function dashboardLeadFields(lead) {
  const fields = ["name", "business", "package", "source", "status", "follow_up_date", "last_contacted", "received_at"];
  return Object.fromEntries(fields.map((field) => {
    const value = lead && lead[field];
    return [field, typeof value === "string" || typeof value === "number" ? value : ""];
  }));
}

export async function onRequestGet({ request, env }) {
  const teamDomain = typeof env.CF_ACCESS_TEAM_DOMAIN === "string"
    ? env.CF_ACCESS_TEAM_DOMAIN.trim().toLowerCase()
    : "";
  const audience = env.CF_ACCESS_AUD;
  if (!teamDomain || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(teamDomain)) {
    return json({
      success: false,
      configured: false,
      message: "Cloudflare Access is not configured for the lead dashboard.",
      summary: null,
      leads: [],
    }, 503);
  }

  try {
    if (!await hasValidAccessToken(request, teamDomain, audience)) {
      return json({ success: false, message: "Authentication required." }, 401);
    }
  } catch (error) {
    console.error("Cloudflare Access token verification failed.", error);
    return json({
      success: false,
      configured: false,
      message: "Dashboard authentication could not be verified.",
      summary: null,
      leads: [],
    }, 503);
  }

  if (new URL(request.url).searchParams.get("access") === "1") {
    const dashboardUrl = new URL("/dashboard.html?access-return=1", request.url);
    return new Response(null, {
      status: 302,
      headers: {
        "Cache-Control": "no-store",
        Location: dashboardUrl.toString(),
      },
    });
  }

  if (!env.GOOGLE_SHEETS_WEBHOOK_URL || !env.GOOGLE_SHEETS_WEBHOOK_TOKEN) {
    return json({
      success: false,
      configured: false,
      message: "Lead tracking is not configured yet. Add Google Sheets webhook settings to Cloudflare before viewing the dashboard.",
      summary: null,
      leads: [],
    }, 503);
  }

  let webhookUrl;
  try {
    webhookUrl = new URL(env.GOOGLE_SHEETS_WEBHOOK_URL);
  } catch {
    return json({
      success: false,
      configured: false,
      message: "The Google Sheets webhook URL is invalid.",
      summary: null,
      leads: [],
    }, 503);
  }

  webhookUrl.searchParams.set("action", "summary");
  webhookUrl.searchParams.set("token", env.GOOGLE_SHEETS_WEBHOOK_TOKEN);

  try {
    const response = await fetch(webhookUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return json({
        success: false,
        configured: true,
        message: "The lead tracker could not be reached.",
        summary: null,
        leads: [],
      }, response.status || 502);
    }

    let result;
    try {
      result = await response.json();
    } catch {
      return json({
        success: false,
        configured: true,
        message: "The lead tracker returned unreadable data.",
        summary: null,
        leads: [],
      }, 502);
    }

    if (!result || result.success !== true) {
      return json({
        success: false,
        configured: true,
        message: typeof result?.message === "string" ? result.message : "The lead tracker rejected the request.",
        summary: null,
        leads: [],
      }, 502);
    }

    return json({
      success: true,
      configured: true,
      summary: result.summary || null,
      leads: Array.isArray(result.leads) ? result.leads.map(dashboardLeadFields) : [],
      generated_at: result.generated_at || null,
    });
  } catch (error) {
    console.error("Lead summary fetch failed.", error);
    return json({
      success: false,
      configured: true,
      message: "The lead summary could not be loaded right now.",
      summary: null,
      leads: [],
    }, 502);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }
  return onRequestGet(context);
}
