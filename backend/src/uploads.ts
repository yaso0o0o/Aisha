// Product photo uploads. Every file is decoded and re-encoded as WebP, so only real
// images are kept, metadata (like phone location) is stripped and size stays small.
// Stored on local disk for now; production should move this to Cloudinary or similar.
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { env } from "./env.js";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 1600;

export const productsDir = path.resolve(env.UPLOAD_DIR, "products");

/** Reads one file from the "file" field into memory, refusing anything too big. */
export const oneImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
}).single("file");

export class NotAnImage extends Error {}

/** Saves a product photo and returns the path the site shows it from. */
export async function saveProductImage(input: Buffer) {
  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate() // respect the phone's orientation before metadata is dropped
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new NotAnImage();
  }
  await mkdir(productsDir, { recursive: true });
  const name = `${randomBytes(12).toString("hex")}.webp`;
  await writeFile(path.join(productsDir, name), output);
  return `/uploads/products/${name}`;
}

/** Deletes an uploaded product photo by the path saveProductImage returned. */
export async function removeUpload(url: string) {
  const name = path.basename(url);
  if (!/^[a-f0-9]+\.webp$/.test(name)) return;
  await rm(path.join(productsDir, name), { force: true });
}
