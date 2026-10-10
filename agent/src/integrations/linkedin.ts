import { z } from "zod";
import type { Env } from "../env";

const API_VERSION_DEFAULT = "202609";
const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const POSTS_URL = "https://api.linkedin.com/rest/posts";
const SCOPES = ["openid", "profile", "w_member_social"];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type LinkedInTokens = { accessToken: string; expiresAt: number };

export type LinkedInConnection = {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  expiresAt: string | null;
  error: string | null;
};

export class LinkedInApiError extends Error {
  constructor(
    message: string,
    readonly outcome: "failed" | "unknown",
  ) {
    super(message);
  }
}

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`LinkedIn setup required: configure ${name} as a Worker secret or variable.`);
  return trimmed;
}

function config(env: Env) {
  const clientId = required(env.LINKEDIN_CLIENT_ID, "LINKEDIN_CLIENT_ID");
  const clientSecret = required(env.LINKEDIN_CLIENT_SECRET, "LINKEDIN_CLIENT_SECRET");
  const redirectUri = required(env.LINKEDIN_REDIRECT_URI, "LINKEDIN_REDIRECT_URI");
  const encryptionSecret = required(env.LINKEDIN_TOKEN_ENCRYPTION_KEY, "LINKEDIN_TOKEN_ENCRYPTION_KEY");
  if (!/^[A-Za-z0-9_-]{43}$/.test(encryptionSecret)) {
    throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must be a 32-byte random base64url value.");
  }
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "https:") throw new Error("LinkedIn redirect URI must use HTTPS.");
  if (redirect.username || redirect.password || redirect.search || redirect.hash ||
    redirect.pathname !== "/api/integrations/linkedin/callback") {
    throw new Error("LinkedIn redirect URI must point directly to the integration callback without credentials, query, or fragment.");
  }
  const apiVersion = env.LINKEDIN_API_VERSION?.trim() || API_VERSION_DEFAULT;
  if (!/^\d{6}$/.test(apiVersion)) throw new Error("LINKEDIN_API_VERSION must use the YYYYMM format.");
  return { clientId, clientSecret, redirectUri, encryptionSecret, apiVersion };
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

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function encryptionKey(env: Env): Promise<CryptoKey> {
  const secret = config(env).encryptionSecret;
  const bytes = decodeBase64Url(secret);
  if (bytes.length !== 32) throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return crypto.subtle.importKey("raw", Uint8Array.from(bytes).buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptTokens(env: Env, tokens: LinkedInTokens): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: Uint8Array.from(iv).buffer },
    await encryptionKey(env),
    encoder.encode(JSON.stringify(tokens)),
  );
  return { iv: base64Url(iv), ciphertext: base64Url(new Uint8Array(ciphertext)) };
}

async function decryptTokens(env: Env, iv: string, ciphertext: string): Promise<LinkedInTokens> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Uint8Array.from(decodeBase64Url(iv)).buffer },
    await encryptionKey(env),
    Uint8Array.from(decodeBase64Url(ciphertext)).buffer,
  );
  const parsed: unknown = JSON.parse(decoder.decode(plaintext));
  const tokens = z.object({ accessToken: z.string().min(1), expiresAt: z.number().finite() }).safeParse(parsed);
  if (!tokens.success) throw new Error("Stored LinkedIn authorization data is invalid. Reconnect LinkedIn.");
  return tokens.data;
}

async function saveTokens(
  env: Env,
  ownerEmail: string,
  memberId: string,
  tokens: LinkedInTokens,
): Promise<void> {
  const encrypted = await encryptTokens(env, tokens);
  await env.DB.prepare(
    `INSERT INTO linkedin_connections (id, owner_email, member_id, token_iv, token_ciphertext, expires_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET owner_email = excluded.owner_email, member_id = excluded.member_id,
       token_iv = excluded.token_iv, token_ciphertext = excluded.token_ciphertext,
       expires_at = excluded.expires_at, connected_at = CURRENT_TIMESTAMP`,
  ).bind(ownerEmail, memberId, encrypted.iv, encrypted.ciphertext, new Date(tokens.expiresAt).toISOString()).run();
}

export async function getLinkedInConnection(env: Env, ownerEmail: string): Promise<LinkedInConnection> {
  let configured = true;
  let error: string | null = null;
  try {
    config(env);
  } catch (cause) {
    configured = false;
    error = cause instanceof Error ? cause.message : "LinkedIn setup is incomplete.";
  }
  const row = await env.DB.prepare(
    "SELECT owner_email, expires_at, connected_at FROM linkedin_connections WHERE id = 1",
  ).first<{ owner_email: string; expires_at: string; connected_at: string }>();
  if (!row) return { configured, connected: false, connectedAt: null, expiresAt: null, error };
  if (row.owner_email !== ownerEmail) {
    return { configured, connected: false, connectedAt: null, expiresAt: null, error: "LinkedIn is connected to a different owner. Disconnect and reconnect the intended account." };
  }
  const expired = Date.parse(row.expires_at) <= Date.now();
  return {
    configured,
    connected: configured && !expired,
    connectedAt: row.connected_at,
    expiresAt: row.expires_at,
    error: expired ? "LinkedIn authorization has expired. Reconnect your account to continue publishing." : error,
  };
}

export async function createLinkedInAuthorization(env: Env, ownerEmail: string): Promise<string> {
  const { clientId, redirectUri } = config(env);
  const state = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await env.DB.prepare("DELETE FROM linkedin_oauth_states WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  await env.DB.prepare(
    "INSERT INTO linkedin_oauth_states (state_hash, owner_email, expires_at) VALUES (?, ?, ?)",
  ).bind(base64Url(await digest(state)), ownerEmail, expiresAt).run();
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES.join(" "),
  }).toString();
  return url.toString();
}

async function exchangeCode(env: Env, code: string): Promise<LinkedInTokens> {
  const { clientId, clientSecret, redirectUri } = config(env);
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("LinkedIn token exchange could not reach LinkedIn. Start the connection again.");
  }
  if (!response.ok) throw new Error(`LinkedIn authorization failed (HTTP ${response.status}). Check the app configuration and try connecting again.`);
  const result = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(await response.json());
  return { accessToken: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
}

export async function completeLinkedInAuthorization(
  env: Env,
  code: string,
  state: string,
  ownerEmail: string,
): Promise<void> {
  const stateHash = base64Url(await digest(state));
  const saved = await env.DB.prepare(
    `DELETE FROM linkedin_oauth_states WHERE state_hash = ? AND owner_email = ? AND expires_at > ?
     RETURNING owner_email`,
  ).bind(stateHash, ownerEmail, new Date().toISOString()).first<{ owner_email: string }>();
  if (!saved) throw new Error("LinkedIn connection expired or could not be verified. Start the connection again.");
  const tokens = await exchangeCode(env, code);
  let profileResponse: Response;
  try {
    profileResponse = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("LinkedIn member information could not be retrieved. Check the granted permissions and reconnect.");
  }
  if (!profileResponse.ok) throw new Error(`LinkedIn member information could not be retrieved (HTTP ${profileResponse.status}). Check the granted permissions and reconnect.`);
  const profile = z.object({ sub: z.string().min(1).max(200) }).parse(await profileResponse.json());
  await saveTokens(env, ownerEmail, profile.sub, tokens);
}

export async function disconnectLinkedIn(env: Env, ownerEmail: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM linkedin_connections WHERE id = 1 AND owner_email = ?").bind(ownerEmail),
    env.DB.prepare("DELETE FROM linkedin_oauth_states WHERE owner_email = ?").bind(ownerEmail),
  ]);
}

async function getAccessToken(env: Env, ownerEmail: string): Promise<{ token: string; memberId: string }> {
  const row = await env.DB.prepare(
    "SELECT owner_email, member_id, token_iv, token_ciphertext, expires_at FROM linkedin_connections WHERE id = 1",
  ).first<{
    owner_email: string;
    member_id: string;
    token_iv: string;
    token_ciphertext: string;
    expires_at: string;
  }>();
  if (!row) throw new Error("Connect LinkedIn before publishing.");
  if (row.owner_email !== ownerEmail) throw new Error("LinkedIn is connected to a different owner. Reconnect the intended account.");
  if (Date.parse(row.expires_at) <= Date.now() + 60_000) throw new Error("LinkedIn authorization has expired or is expiring. Reconnect LinkedIn before publishing.");
  const tokens = await decryptTokens(env, row.token_iv, row.token_ciphertext);
  return { token: tokens.accessToken, memberId: row.member_id };
}

export async function publishLinkedInTextPost(
  env: Env,
  ownerEmail: string,
  commentary: string,
): Promise<string> {
  const { token, memberId } = await getAccessToken(env, ownerEmail);
  const { apiVersion } = config(env);
  let response: Response;
  try {
    response = await fetch(POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${memberId}`,
        commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new LinkedInApiError("LinkedIn's response could not be confirmed. Check your feed before retrying.", "unknown");
  }
  if (response.status >= 200 && response.status < 300 && response.status !== 201) {
    throw new LinkedInApiError("LinkedIn returned an unexpected success response. Check your feed before retrying.", "unknown");
  }
  if (response.status !== 201) {
    if (response.status >= 500) {
      throw new LinkedInApiError("LinkedIn returned a server error. Check your feed before retrying.", "unknown");
    }
    if (response.status === 401) {
      throw new LinkedInApiError("LinkedIn authorization was rejected. Reconnect the account, then retry after confirming no post was created.", "failed");
    }
    if (response.status === 403) {
      throw new LinkedInApiError("LinkedIn denied posting. Check that the app has Share on LinkedIn access and the w_member_social permission.", "failed");
    }
    if (response.status === 429) {
      throw new LinkedInApiError("LinkedIn rate-limited the post. Wait before retrying.", "failed");
    }
    throw new LinkedInApiError(`LinkedIn rejected the post (HTTP ${response.status}). Review the draft and app permissions before retrying.`, "failed");
  }
  const postId = response.headers.get("x-restli-id")?.trim();
  if (!postId) throw new LinkedInApiError("LinkedIn may have created the post but did not return its post ID. Check your feed before retrying.", "unknown");
  return postId;
}
