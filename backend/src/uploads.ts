// Product photo uploads. Every file is decoded and re-encoded as WebP, so only real
// images are kept, metadata (like phone location) is stripped and size stays small.
// Stored in Cloudinary when CLOUDINARY_URL is set, otherwise on the local disk.
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import * as cloud from "./cloud.js";
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
  const id = randomBytes(12).toString("hex");
  if (cloud.useCloud) return cloud.uploadProductPhoto(output, id);
  await mkdir(productsDir, { recursive: true });
  const name = `${id}.webp`;
  await writeFile(path.join(productsDir, name), output);
  return `/uploads/products/${name}`;
}

/**
 * Transfer screenshots are private: saved outside the public uploads folder and only
 * served to a logged-in admin. They are re-encoded like product photos.
 */
export const proofsDir = path.resolve(env.UPLOAD_DIR, "private", "proofs");

/** Saves a transfer screenshot and returns its private file name. */
export async function saveProof(input: Buffer) {
  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new NotAnImage();
  }
  const id = randomBytes(16).toString("hex");
  const name = `${id}.webp`;
  // the order stores the same short name wherever the file lives
  if (cloud.useCloud) {
    await cloud.uploadProofImage(output, id);
    return name;
  }
  await mkdir(proofsDir, { recursive: true });
  await writeFile(path.join(proofsDir, name), output);
  return name;
}

/** Full path of a saved screenshot, or null if the name is not one we made. */
export const proofPath = (name: string) => (/^[a-f0-9]{32}\.webp$/.test(name) ? path.join(proofsDir, name) : null);

export async function removeProof(name: string) {
  const file = proofPath(name);
  if (!file) return;
  if (cloud.useCloud) await cloud.removeProofImage(path.basename(name, ".webp"));
  else await rm(file, { force: true });
}

/** A saved screenshot: its bytes from Cloudinary, or its path on disk. Null if unknown. */
export async function readProof(name: string): Promise<Buffer | string | null> {
  const file = proofPath(name);
  if (!file) return null;
  return cloud.useCloud ? cloud.downloadProof(path.basename(name, ".webp")) : file;
}

/** Reads the order form and an optional "proof" screenshot from a multipart request. */
export const orderForm = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 2, fieldSize: 64 * 1024 },
}).single("proof");

/** Deletes an uploaded product photo by the path saveProductImage returned. */
export async function removeUpload(url: string) {
  if (url.startsWith("https://")) {
    if (cloud.useCloud) await cloud.removeProductPhoto(url);
    return;
  }
  const name = path.basename(url);
  if (!/^[a-f0-9]+\.webp$/.test(name)) return;
  await rm(path.join(productsDir, name), { force: true });
}
