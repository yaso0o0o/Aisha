import "dotenv/config";
import { z } from "zod";

// Stops the server at start-up if a required setting is missing.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().url(),
  /** Number of proxies in front of the API (e.g. 1 behind the host's load balancer), for real client IPs. */
  /** Where uploaded product photos are saved. */
  UPLOAD_DIR: z.string().default("uploads"),
  /** cloudinary://key:secret@cloud. Empty means uploads are kept on the local disk. */
  CLOUDINARY_URL: z.union([z.literal(""), z.string().regex(/^cloudinary:\/\/[^:<>]+:[^@<>]+@[\w-]+$/)]).default(""),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";

if (isProduction && !env.CLOUDINARY_URL) {
  console.warn("CLOUDINARY_URL is not set: uploads stay on local disk and many hosts wipe it on restart.");
}
