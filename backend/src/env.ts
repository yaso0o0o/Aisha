import "dotenv/config";
import { z } from "zod";

// Stops the server at start-up if a required setting is missing.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().url(),
  /** Number of proxies in front of the API (e.g. 1 behind the host's load balancer), for real client IPs. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
