import { json } from "../../_lib/http.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`SELECT * FROM membership_requests ORDER BY created_at DESC LIMIT 200`).all();
  return json({ memberships: results });
}
