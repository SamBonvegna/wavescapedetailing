// Settings pasted into the Cloudflare dashboard often pick up a stray space
// or line break, which Square and Google reject. Trim them once per request.
export async function onRequest({ env, next }) {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value !== value.trim()) env[key] = value.trim();
  }
  return next();
}
