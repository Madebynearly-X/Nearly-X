import { createSession, verifyPassword, hashPassword } from './auth.js';

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readField(data, name, maxLength) {
  const value = data[name];
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return json({ success: false, message: "This request could not be verified." }, 403);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ success: false, message: "Invalid request format." }, 415);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ success: false, message: "Invalid request format." }, 400);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ success: false, message: "Invalid request format." }, 400);
  }

  const email = readField(data, "email", 254);
  const password = readField(data, "password", 128);

  if (!email || !password) {
    return json({ success: false, message: "Email and password are required." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, message: "Invalid email address." }, 400);
  }

  // Get client from database
  const client = await env.DB.prepare(
    'SELECT id, name, email, password_hash FROM clients WHERE email = ?'
  ).bind(email).first();

  if (!client) {
    return json({ success: false, message: "Invalid email or password." }, 401);
  }

  // Verify password
  const isValid = await verifyPassword(password, client.password_hash);
  if (!isValid) {
    return json({ success: false, message: "Invalid email or password." }, 401);
  }

  // Create session
  const sessionToken = await createSession(client.id, env);

  // Set session cookie
  const response = json({
    success: true,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
    }
  });

  response.headers.set(
    "Set-Cookie",
    `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
  );

  return response;
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }
  return onRequestPost(context);
}
