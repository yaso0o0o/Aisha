import "dotenv/config";
import { z } from "zod";

// Stops the server at start-up if a required setting is missing.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().url(),
});

export const env = schema.parse(process.env);
