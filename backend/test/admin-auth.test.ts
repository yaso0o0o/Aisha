// Admin login tests. Uses the local database and a throwaway admin removed at the end.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { app } from "../src/app.js";
import { hashPassword } from "../src/auth.js";
import { prisma } from "../src/db.js";
import { env } from "../src/env.js";

const email = `test-${randomBytes(4).toString("hex")}@aisha.test`;
const password = randomBytes(18).toString("base64url");
const origin = env.FRONTEND_ORIGIN;

const login = (body: object) =>
  request(app).post("/admin/login").set("Origin", origin).send(body);

const sessionCookie = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("aisha_session="));

describe("admin auth", () => {
  before(async () => {
    await prisma.admin.create({ data: { email, passwordHash: await hashPassword(password) } });
  });

  after(async () => {
    await prisma.admin.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("refuses /admin/me without a session", async () => {
    const res = await request(app).get("/admin/me");
    assert.equal(res.status, 401);
  });

  it("refuses a wrong password and an unknown email the same way", async () => {
    const wrong = await login({ email, password: "wrong-password" });
    const unknown = await login({ email: "nobody@aisha.test", password });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(sessionCookie(wrong), undefined);
  });

  it("names the wrong field with 422", async () => {
    const res = await login({ email: "not-an-email", password });
    assert.equal(res.status, 422);
    assert.equal(res.body.field, "email");
  });

  it("refuses a login from another site (CSRF)", async () => {
    const other = await request(app)
      .post("/admin/login")
      .set("Origin", "https://evil.example")
      .send({ email, password });
    const none = await request(app).post("/admin/login").send({ email, password });
    assert.equal(other.status, 403);
    assert.equal(none.status, 403);
  });

  it("logs in with an HttpOnly cookie, then logs out", async () => {
    const res = await login({ email: email.toUpperCase(), password });
    assert.equal(res.status, 200);
    const cookie = sessionCookie(res);
    assert.ok(cookie, "session cookie is set");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const token = cookie.split(";")[0];
    const me = await request(app).get("/admin/me").set("Cookie", token);
    assert.equal(me.status, 200);
    assert.equal(me.body.email, email);

    // Only a hash of the token is stored, never the token itself.
    const raw = decodeURIComponent(token.split("=")[1]);
    assert.equal(await prisma.session.count({ where: { tokenHash: raw } }), 0);

    const out = await request(app).post("/admin/logout").set("Origin", origin).set("Cookie", token);
    assert.equal(out.status, 204);
    const again = await request(app).get("/admin/me").set("Cookie", token);
    assert.equal(again.status, 401);
  });

  it("refuses and removes an expired session", async () => {
    const res = await login({ email, password });
    const token = sessionCookie(res)!.split(";")[0];
    const adminRow = await prisma.admin.findUniqueOrThrow({ where: { email } });
    await prisma.session.updateMany({
      where: { adminId: adminRow.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const me = await request(app).get("/admin/me").set("Cookie", token);
    assert.equal(me.status, 401);
    assert.equal(await prisma.session.count({ where: { adminId: adminRow.id } }), 0);
  });

  it("blocks after too many wrong passwords", async () => {
    let status = 0;
    for (let i = 0; i < 12 && status !== 429; i++) {
      status = (await login({ email, password: "wrong-password" })).status;
    }
    assert.equal(status, 429);
  });
});
