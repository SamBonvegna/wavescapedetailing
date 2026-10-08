// GET /api/admin/photo/uploads/... -> a customer's uploaded photo.
export async function onRequestGet({ env, params }) {
  const key = (params.key || []).join("/");
  if (!env.PHOTOS || !key.startsWith("uploads/")) return new Response("Not found", { status: 404 });
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType || "application/octet-stream" } });
}
