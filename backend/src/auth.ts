// Admin sessions: a random token in an HttpOnly cookie, its SHA-256 hash in the database.
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { CookieOptions, RequestHandler } from "express";
import { prisma } from "./db.js";
import { env, isProduction } from "./env.js";

export const SESSION_COOKIE = "aisha_session";
const SESSION_DAYS = 7;

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

export const hashPassword = (password: string) => hash(password);

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Checked against when the email is unknown, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | undefined;

/** The admin for these credentials, or null. */
export async function checkCredentials(email: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!admin) {
    dummyHash ??= hash(randomBytes(16).toString("hex"));
    await verify(await dummyHash, password);
    return null;
  }
  return (await verify(admin.passwordHash, password)) ? admin : null;
}

/** Starts a session and returns the token for the cookie. */
export async function createSession(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
  await prisma.session.create({
    data: { tokenHash: hashToken(token), adminId, expiresAt: new Date(Date.now() + maxAge) },
  });
  return { token, maxAge };
}

export async function endSession(token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

declare module "express-serve-static-core" {
  interface Request {
    admin?: { id: string; email: string };
  }
}

/** Lets the request through only with a valid, unexpired session. */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const token: string | undefined = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { admin: true },
    });
    if (session && session.expiresAt > new Date()) {
      req.admin = { id: session.admin.id, email: session.admin.email };
      next();
      return;
    }
    if (session) await prisma.session.delete({ where: { id: session.id } });
  }
  res.status(401).json({ error: "unauthorized" });
};

/**
 * CSRF protection: a request that changes something must come from the shop's own site.
 * Browsers always send Origin on cross-site POST/PATCH/PUT/DELETE, and pages cannot fake it.
 */
export const sameOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.get("origin") === env.FRONTEND_ORIGIN) {
    next();
    return;
  }
  res.status(403).json({ error: "bad_origin" });
};
