import { json, fail, readJson } from "../../../_lib/http.js";

export async function onRequestPost({ request, env, params }) {
  const body = await readJson(request);
  if (!["new", "active", "declined"].includes(body?.status)) return fail("Unknown status.");
  const r = await env.DB.prepare(`UPDATE membership_requests SET status = ?2 WHERE id = ?1`).bind(params.id, body.status).run();
  if (!r.meta.changes) return fail("Request not found.", 404);
  return json({ ok: true });
}
