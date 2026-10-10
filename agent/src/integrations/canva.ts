import type { Env } from "../env";

const CANVA_API = "https://api.canva.com/rest/v1";
const CANVA_AUTHORIZE = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN = `${CANVA_API}/oauth/token`;
const CANVA_SCOPES = ["design:content:write", "design:content:read", "design:meta:read"];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type CanvaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type CanvaJobResponse = {
  job?: {
    id?: string;
    status?: string;
    result?: { design?: { id?: string; url?: string }; urls?: string[] };
  };
};

export type CanvaConnection = {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  error: string | null;
};

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Canva setup required: configure ${name} as a Worker secret or variable.`);
  return trimmed;
}

function encryptionSecret(env: Env): string {
  const secret = required(env.CANVA_TOKEN_ENCRYPTION_KEY, "CANVA_TOKEN_ENCRYPTION_KEY");
  if (!/^[A-Za-z0-9_-]{43,}$/.test(secret)) {
    throw new Error("CANVA_TOKEN_ENCRYPTION_KEY must be a 32-byte random base64url value.");
  }
  return secret;
}

function config(env: Env) {
  const clientId = required(env.CANVA_CLIENT_ID, "CANVA_CLIENT_ID");
  const clientSecret = required(env.CANVA_CLIENT_SECRET, "CANVA_CLIENT_SECRET");
  const redirectUri = required(env.CANVA_REDIRECT_URI, "CANVA_REDIRECT_URI");
  encryptionSecret(env);
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:" && !(redirect.protocol === "http:" && ["localhost", "127.0.0.1"].includes(redirect.hostname))) {
    throw new Error("Canva redirect URI must use HTTPS, except for localhost development.");
  }
  if (redirect.username || redirect.password || redirect.search || redirect.hash ||
    redirect.pathname !== "/api/integrations/canva/callback") {
    throw new Error("Canva redirect URI must point directly to the integration callback without credentials, query, or fragment.");
  }
  return { clientId, clientSecret, redirectUri };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function randomUrlSafe(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function encryptionKey(env: Env): Promise<CryptoKey> {
  const secret = encryptionSecret(env);
  const keyBytes = await digest(secret);
  return crypto.subtle.importKey("raw", Uint8Array.from(keyBytes).buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptTokens(env: Env, tokens: CanvaTokens): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: Uint8Array.from(iv).buffer },
    await encryptionKey(env),
    encoder.encode(JSON.stringify(tokens)),
  );
  return { iv: base64Url(iv), ciphertext: base64Url(new Uint8Array(ciphertext)) };
}

async function decryptTokens(env: Env, iv: string, ciphertext: string): Promise<CanvaTokens> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(decodeBase64Url(iv)).buffer },
    await encryptionKey(env),
    Uint8Array.from(decodeBase64Url(ciphertext)).buffer,
  );
  const value: unknown = JSON.parse(decoder.decode(plaintext));
  if (!value || typeof value !== "object") throw new Error("Stored Canva authorization data is invalid. Reconnect Canva.");
  const tokens = value as Partial<CanvaTokens>;
  if (typeof tokens.accessToken !== "string" || typeof tokens.refreshToken !== "string" || typeof tokens.expiresAt !== "number") {
    throw new Error("Stored Canva authorization data is incomplete. Reconnect Canva.");
  }
  return tokens as CanvaTokens;
}

function parseTokenResponse(value: unknown): Omit<CanvaTokens, "expiresAt"> & { expiresIn: number } {
  if (!value || typeof value !== "object") throw new Error("Canva returned an invalid token response.");
  const result = value as Record<string, unknown>;
  if (typeof result.access_token !== "string" || typeof result.refresh_token !== "string" ||
    typeof result.expires_in !== "number" || !Number.isFinite(result.expires_in) || result.expires_in <= 0) {
    throw new Error("Canva returned incomplete authorization tokens. Reconnect Canva.");
  }
  return { accessToken: result.access_token, refreshToken: result.refresh_token, expiresIn: result.expires_in };
}

async function requestTokens(
  env: Env,
  fields: Record<string, string>,
): Promise<CanvaTokens> {
  const { clientId, clientSecret } = config(env);
  const response = await fetch(CANVA_TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(fields),
  });
  if (!response.ok) throw new Error(`Canva authorization failed (HTTP ${response.status}). Check the Canva app configuration and try connecting again.`);
  const result = parseTokenResponse(await response.json());
  return { ...result, expiresAt: Date.now() + result.expiresIn * 1000 };
}

async function saveTokens(env: Env, tokens: CanvaTokens, ownerEmail: string): Promise<void> {
  const encrypted = await encryptTokens(env, tokens);
  await env.DB.prepare(
    `INSERT INTO integration_connections (provider, owner_email, token_iv, token_ciphertext, expires_at)
     VALUES ('canva', ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET owner_email = excluded.owner_email,
       token_iv = excluded.token_iv, token_ciphertext = excluded.token_ciphertext,
       expires_at = excluded.expires_at`,
  ).bind(ownerEmail, encrypted.iv, encrypted.ciphertext, new Date(tokens.expiresAt).toISOString()).run();
}

async function refreshTokens(env: Env, tokens: CanvaTokens, ownerEmail: string): Promise<CanvaTokens> {
  const refreshed = await requestTokens(env, { grant_type: "refresh_token", refresh_token: tokens.refreshToken });
  await saveTokens(env, refreshed, ownerEmail);
  return refreshed;
}

async function accessToken(env: Env, ownerEmail: string): Promise<string> {
  const row = await env.DB.prepare(
    "SELECT token_iv, token_ciphertext, owner_email FROM integration_connections WHERE provider = 'canva'",
  ).first<{ token_iv: string; token_ciphertext: string; owner_email: string }>();
  if (!row) throw new Error("Connect Canva before creating a video.");
  if (row.owner_email !== ownerEmail) throw new Error("Canva is connected to a different owner. Disconnect and reconnect the intended account.");
  let tokens = await decryptTokens(env, row.token_iv, row.token_ciphertext);
  if (tokens.expiresAt <= Date.now() + 60_000) tokens = await refreshTokens(env, tokens, ownerEmail);
  return tokens.accessToken;
}

export async function getCanvaConnection(env: Env): Promise<CanvaConnection> {
  let configured = true;
  let error: string | null = null;
  try {
    config(env);
  } catch (cause) {
    configured = false;
    error = cause instanceof Error ? cause.message : "Canva setup is incomplete.";
  }
  const row = await env.DB.prepare(
    "SELECT connected_at FROM integration_connections WHERE provider = 'canva'",
  ).first<{ connected_at: string }>();
  return { configured, connected: Boolean(row), connectedAt: row?.connected_at ?? null, error };
}

export async function createCanvaAuthorization(env: Env, ownerEmail: string): Promise<string> {
  const { clientId, redirectUri } = config(env);
  const state = randomUrlSafe(32);
  const verifier = randomUrlSafe(48);
  const challenge = base64Url(await digest(verifier));
  const stateHash = base64Url(await digest(state));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await env.DB.prepare("DELETE FROM canva_oauth_states WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  await env.DB.prepare(
    "INSERT INTO canva_oauth_states (state_hash, code_verifier, owner_email, expires_at) VALUES (?, ?, ?, ?)",
  ).bind(stateHash, verifier, ownerEmail, expiresAt).run();
  const url = new URL(CANVA_AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "s256",
    scope: CANVA_SCOPES.join(" "),
    state,
    redirect_uri: redirectUri,
  }).toString();
  return url.toString();
}

export async function completeCanvaAuthorization(
  env: Env,
  code: string,
  state: string,
  ownerEmail: string,
): Promise<void> {
  const stateHash = base64Url(await digest(state));
  const saved = await env.DB.prepare(
    `DELETE FROM canva_oauth_states WHERE state_hash = ? AND owner_email = ? AND expires_at > ?
     RETURNING code_verifier`,
  ).bind(stateHash, ownerEmail, new Date().toISOString()).first<{ code_verifier: string }>();
  if (!saved) throw new Error("Canva connection expired or could not be verified. Start the connection again.");
  const { redirectUri } = config(env);
  const tokens = await requestTokens(env, {
    grant_type: "authorization_code",
    code,
    code_verifier: saved.code_verifier,
    redirect_uri: redirectUri,
  });
  await saveTokens(env, tokens, ownerEmail);
}

export async function disconnectCanva(env: Env, ownerEmail: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM integration_connections WHERE provider = 'canva' AND owner_email = ?").bind(ownerEmail),
    env.DB.prepare("DELETE FROM canva_oauth_states WHERE owner_email = ?").bind(ownerEmail),
  ]);
}

async function canvaRequest<T>(env: Env, ownerEmail: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken(env, ownerEmail);
  const response = await fetch(`${CANVA_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const message = response.status === 401
      ? "Canva authorization expired or was revoked. Disconnect and reconnect Canva."
      : `Canva video request failed (HTTP ${response.status}). Check the template fields and Canva account permissions.`;
    throw new Error(message);
  }
  return await response.json() as T;
}

export async function createCanvaAutofill(
  env: Env,
  ownerEmail: string,
  brandTemplateId: string,
  data: Record<string, { type: "text"; text: string } | { type: "video"; asset_id: string }>,
): Promise<string> {
  const result = await canvaRequest<CanvaJobResponse>(env, ownerEmail, "/autofills", {
    method: "POST",
    body: JSON.stringify({ type: "create_from_brand_template", brand_template_id: brandTemplateId, data }),
  });
  const jobId = result.job?.id;
  if (!jobId) throw new Error("Canva did not return an autofill job ID.");
  return jobId;
}

export async function getCanvaAutofill(env: Env, ownerEmail: string, jobId: string): Promise<CanvaJobResponse["job"]> {
  const result = await canvaRequest<CanvaJobResponse>(env, ownerEmail, `/autofills/${encodeURIComponent(jobId)}`);
  if (!result.job?.status) throw new Error("Canva returned an incomplete autofill job status.");
  return result.job;
}

export async function createCanvaExport(env: Env, ownerEmail: string, designId: string): Promise<string> {
  const result = await canvaRequest<CanvaJobResponse>(env, ownerEmail, "/exports", {
    method: "POST",
    body: JSON.stringify({ design_id: designId, format: { type: "mp4" } }),
  });
  const jobId = result.job?.id;
  if (!jobId) throw new Error("Canva did not return an MP4 export job ID.");
  return jobId;
}

export async function getCanvaExport(env: Env, ownerEmail: string, jobId: string): Promise<CanvaJobResponse["job"]> {
  const result = await canvaRequest<CanvaJobResponse>(env, ownerEmail, `/exports/${encodeURIComponent(jobId)}`);
  if (!result.job?.status) throw new Error("Canva returned an incomplete export job status.");
  return result.job;
}
