import type { Response } from "express";
import type { ZodError } from "zod";

/** 422 with the name of the first wrong field, as the spec asks. */
export function invalid(res: Response, error: ZodError) {
  const issue = error.issues[0];
  res.status(422).json({ error: "invalid", field: issue?.path.join(".") ?? null });
}
