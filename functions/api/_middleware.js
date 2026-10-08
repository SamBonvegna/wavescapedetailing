// Creates the booking tables on first use, so a new Cloudflare database works
// without running migrations by hand. Mirrors migrations/0001_init.sql.
import schema from "../_lib/schema.js";

let ready = null;

export async function onRequest({ env, next }) {
  if (env.DB) {
    ready ??= env.DB.batch(schema.map((sql) => env.DB.prepare(sql))).catch((e) => {
      ready = null;
      throw e;
    });
    await ready;
  }
  return next();
}
