// Cloudinary storage, used when CLOUDINARY_URL is set. Free hosts wipe the local
// disk on every restart, so without it uploaded photos and screenshots are lost.
import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

if (env.CLOUDINARY_URL) {
  // cloudinary://API_KEY:API_SECRET@CLOUD_NAME
  const url = new URL(env.CLOUDINARY_URL);
  cloudinary.config({
    cloud_name: url.hostname,
    api_key: decodeURIComponent(url.username),
    api_secret: decodeURIComponent(url.password),
    secure: true,
  });
}

export const useCloud = Boolean(env.CLOUDINARY_URL);

const PRODUCTS = "aisha/products";
const PROOFS = "aisha/proofs";

function upload(file: Buffer, options: { public_id: string; type: "upload" | "authenticated" }) {
  return new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ ...options, resource_type: "image", overwrite: false }, (error, result) => {
        if (error || !result) reject(new Error(`Cloudinary upload failed: ${error?.message ?? "no result"}`));
        else resolve(result);
      })
      .end(file);
  });
}

const destroy = (publicId: string, type: "upload" | "authenticated") =>
  cloudinary.uploader.destroy(publicId, { type, resource_type: "image", invalidate: true });

/** Public product photo; returns its https address. */
export async function uploadProductPhoto(file: Buffer, id: string) {
  return (await upload(file, { public_id: `${PRODUCTS}/${id}`, type: "upload" })).secure_url;
}

/** The public id of a product photo in our own Cloudinary account, or null. */
export function productPublicId(url: string) {
  const cloud = cloudinary.config().cloud_name;
  const match = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:v\d+\/)?(aisha\/products\/[a-f0-9]+)\.webp$/.exec(url);
  return match && match[1] === cloud ? match[2] : null;
}

export async function removeProductPhoto(url: string) {
  const id = productPublicId(url);
  if (id) await destroy(id, "upload");
}

/**
 * Transfer screenshots are "authenticated" assets: they have no public address and
 * can only be read through a link signed with the API secret, which stays here.
 */
export async function uploadProofImage(file: Buffer, id: string) {
  await upload(file, { public_id: `${PROOFS}/${id}`, type: "authenticated" });
}

/** The screenshot's bytes, or null if it is gone. The signed link never leaves the server. */
export async function downloadProof(id: string) {
  const link = cloudinary.url(`${PROOFS}/${id}`, {
    type: "authenticated",
    resource_type: "image",
    format: "webp",
    sign_url: true,
    secure: true,
  });
  const res = await fetch(link, { signal: AbortSignal.timeout(15_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloudinary download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function removeProofImage(id: string) {
  await destroy(`${PROOFS}/${id}`, "authenticated");
}
