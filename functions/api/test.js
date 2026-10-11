export async function onRequest(context) {
  return new Response(JSON.stringify({ success: true, message: "Functions are working" }), {
    headers: { "Content-Type": "application/json" },
  });
}
