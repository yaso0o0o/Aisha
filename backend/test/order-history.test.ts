// The history a customer sees follows what the dashboard does.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { loggedInAdmin, origin } from "./helpers.js";

const NAME = "zzhistory customer";
let admin: Awaited<ReturnType<typeof loggedInAdmin>>;
let variantId = "";

const kinds = async (code: string, token: string) => {
  const res = await request(app).get(`/orders/${code}?token=${token}`);
  return (res.body.history as { kind: string }[]).map((h) => h.kind);
};

describe("order history", () => {
  before(async () => {
    admin = await loggedInAdmin();
    const category = await prisma.category.findFirstOrThrow();
    const product = await prisma.product.create({
      data: { slug: "zzhistory-item", categoryId: category.id, nameAr: "اختبار", nameEn: "History", price: 100, variants: { create: { stock: 5 } } },
      include: { variants: true },
    });
    variantId = product.variants[0].id;
    await prisma.shippingZone.create({ data: { id: "zzhistory-zone", nameAr: "اختبار", nameEn: "Test", price: 10 } });
  });

  after(async () => {
    await prisma.order.deleteMany({ where: { name: NAME } });
    await prisma.product.deleteMany({ where: { slug: "zzhistory-item" } });
    await prisma.shippingZone.deleteMany({ where: { id: "zzhistory-zone" } });
    await admin.remove();
    await prisma.$disconnect();
  });

  const place = async () => {
    const res = await request(app).post("/orders").send({
      name: NAME, phone: "01000000000", address: "test address", zoneId: "zzhistory-zone", payment: "cod",
      items: [{ variantId, qty: 1 }],
    });
    assert.equal(res.status, 201);
    return res.body as { code: string; token: string; history: { kind: string }[] };
  };
  const patch = async (code: string, body: object) => {
    const { id } = await prisma.order.findUniqueOrThrow({ where: { code } });
    return request(app).patch(`/admin/orders/${id}`).set("Cookie", admin.cookie).set("Origin", origin).send(body);
  };

  it("records each status change once, in order", async () => {
    const order = await place();
    assert.deepEqual(order.history.map((h) => h.kind), ["new"]);

    assert.equal((await patch(order.code, { status: "confirmed" })).status, 200);
    await patch(order.code, { status: "confirmed" });
    await patch(order.code, { paid: true });
    await patch(order.code, { status: "shipped" });
    await patch(order.code, { status: "delivered" });
    assert.deepEqual(await kinds(order.code, order.token), ["new", "confirmed", "shipped", "delivered"]);
  });

  it("records a cancellation", async () => {
    const order = await place();
    await patch(order.code, { status: "cancelled" });
    await patch(order.code, { status: "cancelled" });
    assert.deepEqual(await kinds(order.code, order.token), ["new", "cancelled"]);
  });
});
