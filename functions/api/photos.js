import { json, fail, newId } from "../_lib/http.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const MAX_BYTES = 10 * 1024 * 1024;

// POST multipart (field "photo") -> { key }. Photos of paint or gelcoat condition.
export async function onRequestPost({ request, env }) {
  if (!env.PHOTOS) return fail("Photo uploads aren't set up yet. You can text photos to us instead.", 503);
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!file || typeof file === "string") return fail("Choose a photo to upload.");
  const ext = TYPES[file.type];
  if (!ext) return fail("Photos must be JPG, PNG, WebP or HEIC.");
  if (file.size > MAX_BYTES) return fail("Each photo must be under 10 MB.");
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${newId()}.${ext}`;
  await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return json({ key });
}
