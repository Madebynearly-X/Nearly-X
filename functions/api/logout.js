import { deleteSession } from './auth.js';

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function onRequestPost({ request, env }) {
  const sessionToken = request.headers.get("Cookie")?.match(/session=([^;]+)/)?.[1];

  if (sessionToken) {
    await deleteSession(sessionToken, env);
  }

  const response = json({ success: true });
  response.headers.set(
    "Set-Cookie",
    "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
  );

  return response;
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }
  return onRequestPost(context);
}
