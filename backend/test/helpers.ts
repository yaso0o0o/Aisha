// Shared test setup: a throwaway admin and a logged-in cookie.
import { randomBytes } from "node:crypto";
import request from "supertest";
import { app } from "../src/app.js";
import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";
import { env } from "../src/env.js";

export const origin = env.FRONTEND_ORIGIN;

export async function loggedInAdmin() {
  const email = `test-${randomBytes(4).toString("hex")}@aisha.test`;
  const password = randomBytes(18).toString("base64url");
  await prisma.admin.create({ data: { email, passwordHash: await hashPassword(password) } });
  const res = await request(app).post("/admin/login").set("Origin", origin).send({ email, password });
  const cookie = ([] as string[]).concat(res.headers["set-cookie"] ?? [])[0].split(";")[0];
  return {
    email,
    cookie,
    remove: () => prisma.admin.deleteMany({ where: { email } }),
  };
}
