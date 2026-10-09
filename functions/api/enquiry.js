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
  if (origin && origin !== new URL(request.url).origin) {
    return json({ success: false, message: "This form request could not be verified." }, 403);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 20_000) {
    return json({ success: false, message: "The form submission is too large." }, 413);
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return json({ success: false, message: "Please check the form and try again." }, 400);
  }

  if (rawBody.length > 20_000) {
    return json({ success: false, message: "The form submission is too large." }, 413);
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return json({ success: false, message: "Please check the form and try again." }, 400);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ success: false, message: "Please check the form and try again." }, 400);
  }

  if (readField(data, "_honey", 500)) {
    return json({ success: false, message: "Please check the form and try again." }, 400);
  }

  const fields = {
    name: readField(data, "name", 120),
    email: readField(data, "email", 254),
    phone: readField(data, "phone", 50),
    business: readField(data, "business", 160),
    package: readField(data, "package", 80),
    details: readField(data, "details", 5000),
  };

  if (!fields.name || !fields.email || !fields.details) {
    return json({ success: false, message: "Please complete the required fields." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return json({ success: false, message: "Please enter a valid email address." }, 400);
  }

  if (!env.WEB3FORMS_ACCESS_KEY) {
    console.error("Enquiry form is not configured: WEB3FORMS_ACCESS_KEY is missing.");
    return json({ success: false, message: "The enquiry form is temporarily unavailable. Please email us directly." }, 503);
  }

  let providerResponse;
  try {
    providerResponse = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: env.WEB3FORMS_ACCESS_KEY,
        subject: "New enquiry from NEARLY Studio website",
        from_name: "NEARLY Studio website",
        replyto: fields.email,
        ...fields,
      }),
    });
  } catch (error) {
    console.error("Web3Forms request failed.", error);
    return json({ success: false, message: "We couldn't send your enquiry just now. Please try again or email us directly." }, 502);
  }

  let result;
  try {
    result = await providerResponse.json();
  } catch (error) {
    console.error("Web3Forms returned an unreadable response.", error);
    return json({ success: false, message: "We couldn't confirm delivery. Please try again or email us directly." }, 502);
  }

  if (!providerResponse.ok || result.success !== true) {
    console.error("Web3Forms rejected an enquiry.", {
      status: providerResponse.status,
      message: typeof result.message === "string" ? result.message : "Unknown provider error",
    });
    return json({ success: false, message: "We couldn't send your enquiry just now. Please try again or email us directly." }, 502);
  }

  return json({ success: true });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }
  return onRequestPost(context);
}
