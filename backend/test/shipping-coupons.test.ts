// Shipping zones and coupons, against the local database.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { app } from "../src/app.js";
import { cairoToday, couponProblem } from "../src/coupons.js";
import { prisma } from "../src/db.js";
import { loggedInAdmin, origin } from "./helpers.js";

let admin: Awaited<ReturnType<typeof loggedInAdmin>>;

const as = () => ({
  get: (url: string) => request(app).get(url).set("Cookie", admin.cookie),
  post: (url: string) => request(app).post(url).set("Cookie", admin.cookie).set("Origin", origin),
  patch: (url: string) => request(app).patch(url).set("Cookie", admin.cookie).set("Origin", origin),
  del: (url: string) => request(app).delete(url).set("Cookie", admin.cookie).set("Origin", origin),
});

const check = (code: string, subtotal: number) => request(app).post("/coupons/check").send({ code, subtotal });

/** YYYY-MM-DD, n days from today in Cairo. */
const cairoDay = (n: number) => {
  const d = new Date(`${cairoToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe("shipping zones and coupons", () => {
  before(async () => {
    admin = await loggedInAdmin();
  });

  after(async () => {
    await prisma.shippingZone.deleteMany({ where: { id: { startsWith: "zz-test" } } });
    await prisma.coupon.deleteMany({ where: { code: { startsWith: "ZZTEST" } } });
    await admin.remove();
    await prisma.$disconnect();
  });

  it("needs a session for the dashboard routes", async () => {
    assert.equal((await request(app).get("/admin/shipping-zones")).status, 401);
    assert.equal((await request(app).get("/admin/coupons")).status, 401);
  });

  it("adds, edits, hides and deletes a shipping zone", async () => {
    const created = await as().post("/admin/shipping-zones").send({ nameAr: "منطقة اختبار", nameEn: "ZZ Test Zone", price: 120 });
    assert.equal(created.status, 201);
    assert.equal(created.body.id, "zz-test-zone");
    assert.equal(created.body.active, true);

    const dup = await as().post("/admin/shipping-zones").send({ id: "zz-test-zone", nameAr: "تاني", price: 1 });
    assert.equal(dup.status, 409);
    const bad = await as().post("/admin/shipping-zones").send({ nameAr: "x", price: -5 });
    assert.equal(bad.status, 422);
    assert.equal(bad.body.field, "price");

    const edited = await as().patch("/admin/shipping-zones/zz-test-zone").send({ price: 150 });
    assert.equal(edited.body.price, 150);

    const shop = async () => (await request(app).get("/shipping-zones")).body.map((z: { id: string }) => z.id);
    assert.ok((await shop()).includes("zz-test-zone"));
    await as().patch("/admin/shipping-zones/zz-test-zone").send({ active: false });
    assert.ok(!(await shop()).includes("zz-test-zone"), "paused zone is not offered");

    assert.equal((await as().del("/admin/shipping-zones/zz-test-zone")).status, 204);
    assert.equal((await as().del("/admin/shipping-zones/zz-test-zone")).status, 404);
  });

  it("adds coupons in capitals and refuses bad ones", async () => {
    const created = await as().post("/admin/coupons").send({ code: "zztest10", percent: 10 });
    assert.equal(created.status, 201);
    assert.equal(created.body.code, "ZZTEST10");
    assert.equal(created.body.validUntil, null);

    assert.equal((await as().post("/admin/coupons").send({ code: "ZZTEST10", percent: 5 })).status, 409);
    const cases: [object, string][] = [
      [{ code: "ZZTEST-A", percent: 95 }, "percent"],
      [{ code: "ZZTEST-B", percent: 0 }, "percent"],
      [{ code: "zz test", percent: 10 }, "code"],
      [{ code: "ZZTEST-C", percent: 10, validUntil: "2026-02-30" }, "validUntil"],
    ];
    for (const [body, field] of cases) {
      const res = await as().post("/admin/coupons").send(body);
      assert.equal(res.status, 422, `422 for ${field}`);
      assert.equal(res.body.field, field);
    }
  });

  it("checks coupons the way the spec says", async () => {
    await as().post("/admin/coupons").send({ code: "ZZTEST-MIN", percent: 15, minTotal: 1000 });
    await as().post("/admin/coupons").send({ code: "ZZTEST-TODAY", percent: 20, validUntil: cairoDay(0) });
    await as().post("/admin/coupons").send({ code: "ZZTEST-OLD", percent: 20, validUntil: cairoDay(-1) });
    const paused = (await as().post("/admin/coupons").send({ code: "ZZTEST-OFF", percent: 20 })).body;
    await as().patch(`/admin/coupons/${paused.id}`).send({ active: false });

    assert.deepEqual((await check(" zztest10 ", 999)).body, { valid: true, code: "ZZTEST10", percent: 10, discount: 100 });
    assert.equal((await check("ZZTEST-TODAY", 500)).body.valid, true, "the last day itself counts");
    assert.deepEqual((await check("ZZTEST-OLD", 500)).body, { valid: false, reason: "invalid" });
    assert.deepEqual((await check("ZZTEST-OFF", 500)).body, { valid: false, reason: "invalid" });
    assert.deepEqual((await check("ZZTEST-NONE", 500)).body, { valid: false, reason: "invalid" });
    assert.deepEqual((await check("ZZTEST-MIN", 999)).body, { valid: false, reason: "below_minimum", minTotal: 1000 });
    assert.equal((await check("ZZTEST-MIN", 1000)).body.discount, 150);
  });

  it("ends a coupon at midnight Cairo time, not UTC", () => {
    const coupon = {
      id: "x", code: "X", percent: 10, minTotal: 0, active: true, createdAt: new Date(),
      validUntil: new Date("2026-03-10T00:00:00Z"),
    };
    // 22:30 UTC on 10 March is already 00:30 on 11 March in Cairo (UTC+2).
    assert.equal(couponProblem(coupon, 100, new Date("2026-03-10T21:30:00Z")), null);
    assert.equal(couponProblem(coupon, 100, new Date("2026-03-10T22:30:00Z")), "expired");
  });

  it("limits coupon guessing", async () => {
    let status = 0;
    for (let i = 0; i < 30 && status !== 429; i++) status = (await check(`ZZTEST-GUESS${i}`, 100)).status;
    assert.equal(status, 429);
  });
});
