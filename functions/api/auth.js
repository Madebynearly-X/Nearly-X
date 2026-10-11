// Authentication helper functions

export async function createSession(clientId, env) {
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await env.DB.prepare(
    'INSERT INTO sessions (token, client_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionToken, clientId, expiresAt.toISOString()).run();

  return sessionToken;
}

export async function validateSession(token, env) {
  if (!token) return null;

  const result = await env.DB.prepare(
    'SELECT client_id, expires_at FROM sessions WHERE token = ?'
  ).bind(token).first();

  if (!result) return null;

  // Check if session is expired
  if (new Date(result.expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }

  return result.client_id;
}

export async function deleteSession(token, env) {
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Middleware to check authentication
export function requireAuth(handler) {
  return async (context) => {
    const sessionToken = context.request.headers.get("Cookie")?.match(/session=([^;]+)/)?.[1];
    const clientId = await validateSession(sessionToken, context.env);

    if (!clientId) {
      return new Response(JSON.stringify({ success: false, message: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return handler({ ...context, clientId });
  };
}
