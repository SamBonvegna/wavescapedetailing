// Password protection for the owner's admin page and admin API (HTTP Basic auth).

async function digest(s) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

async function same(a, b) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function requireAdmin({ request, env, next }) {
  if (!env.ADMIN_PASSWORD) return new Response("Set ADMIN_PASSWORD to use the admin page.", { status: 503 });
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try { decoded = atob(header.slice(6)); } catch {}
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (await same(pass, env.ADMIN_PASSWORD)) {
      const res = await next();
      const out = new Response(res.body, res);
      out.headers.set("cache-control", "no-store");
      out.headers.set("x-robots-tag", "noindex");
      return out;
    }
  }
  return new Response("Sign in to see bookings.", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="Wave Scape admin", charset="UTF-8"' },
  });
}
