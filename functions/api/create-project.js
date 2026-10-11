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

  const clientId = Number(readField(data, "client_id", 10));
  const name = readField(data, "name", 160);
  const package = readField(data, "package", 80);
  const status = readField(data, "status", 50) || "pending";

  if (!clientId || !name || !package) {
    return json({ success: false, message: "Client ID, name, and package are required." }, 400);
  }

  // Verify client exists
  const client = await env.DB.prepare(
    'SELECT id FROM clients WHERE id = ?'
  ).bind(clientId).first();

  if (!client) {
    return json({ success: false, message: "Client not found." }, 404);
  }

  try {
    const result = await env.DB.prepare(
      'INSERT INTO projects (client_id, name, package, status) VALUES (?, ?, ?, ?)'
    ).bind(clientId, name, package, status).run();

    if (!result.success) {
      return json({ success: false, message: "Failed to create project." }, 500);
    }

    return json({
      success: true,
      project: {
        id: result.meta.last_row_id,
        client_id: clientId,
        name,
        package,
        status,
      }
    });
  } catch (error) {
    console.error("Project creation error:", error);
    return json({ success: false, message: "Failed to create project." }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }
  return onRequestPost(context);
}
