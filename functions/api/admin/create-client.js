import { hashPassword } from '../auth.js';

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

// Simple admin key check (in production, use proper admin authentication)
function verifyAdminKey(request, env) {
  const authHeader = request.headers.get("Authorization");
  const adminKey = env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error("Admin API key not configured");
    return false;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const providedKey = authHeader.slice(7);
  return providedKey === adminKey;
}

export async function onRequestPost({ request, env }) {
  // Verify admin access
  if (!verifyAdminKey(request, env)) {
    return json({ success: false, message: "Unauthorized" }, 401);
  }

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

  const name = readField(data, "name", 120);
  const email = readField(data, "email", 254);
  const phone = readField(data, "phone", 50);
  const business = readField(data, "business", 160);
  const password = readField(data, "password", 128);

  if (!name || !email || !password) {
    return json({ success: false, message: "Name, email, and password are required." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, message: "Invalid email address." }, 400);
  }

  if (password.length < 8) {
    return json({ success: false, message: "Password must be at least 8 characters." }, 400);
  }

  // Check if client already exists
  const existing = await env.DB.prepare(
    'SELECT id FROM clients WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    return json({ success: false, message: "A client with this email already exists." }, 409);
  }

  // Hash password and create client
  const passwordHash = await hashPassword(password);

  try {
    const result = await env.DB.prepare(
      'INSERT INTO clients (name, email, phone, business, password_hash) VALUES (?, ?, ?, ?, ?)'
    ).bind(name, email, phone, business, passwordHash).run();

    if (!result.success) {
      return json({ success: false, message: "Failed to create client account." }, 500);
    }

    return json({
      success: true,
      client: {
        id: result.meta.last_row_id,
        name,
        email,
        phone,
        business,
      }
    });
  } catch (error) {
    console.error("Client creation error:", error);
    return json({ success: false, message: "Failed to create client account." }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }
  return onRequestPost(context);
}
