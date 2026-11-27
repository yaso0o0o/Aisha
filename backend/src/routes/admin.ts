// Dashboard endpoints. Everything except login needs a session (spec section 6 and 7).
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  SESSION_COOKIE,
  checkCredentials,
  cookieOptions,
  createSession,
  endSession,
  requireAdmin,
  sameOrigin,
} from "../auth.js";
import { prisma } from "../db.js";
import { invalid } from "../validate.js";

export const admin = Router();

admin.use("/admin", sameOrigin);

// 10 wrong tries per 15 minutes per IP; correct logins do not count.
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

const loginBody = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

admin.post("/admin/login", loginLimit, async (req, res) => {
  const body = loginBody.safeParse(req.body);
  if (!body.success) {
    invalid(res, body.error);
    return;
  }
  const found = await checkCredentials(body.data.email, body.data.password);
  if (!found) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  const { token, maxAge } = await createSession(found.id);
  await prisma.auditLog.create({ data: { adminId: found.id, action: "admin.login" } });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge });
  res.json({ email: found.email });
});

admin.post("/admin/logout", async (req, res) => {
  await endSession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

// Every /admin route below this line needs a logged-in admin.
admin.use("/admin", requireAdmin);

admin.get("/admin/me", (req, res) => {
  res.json({ email: req.admin!.email });
});
