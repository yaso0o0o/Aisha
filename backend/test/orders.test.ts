// Orders, stock and InstaPay, against the local database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { removeProof, proofsDir } from "../src/uploads.js";
import { loggedInAdmin, origin } from "./helpers.js";

let admin: Awaited<ReturnType<typeof loggedInAdmin>>;
let red: string;
let black: string;
let madeToOrder: string;
let hiddenVariant: string;
let savedInstapay: { instapayNumber: string; instapayName: string } | null;

const CUSTOMER = "ZZ Test Customer";
const customer = { name: CUSTOMER, phone: "01000000000", address: "Test street 1", zoneId: "zzorders-zone", payment: "cod" };

const as = () => ({
  get: (url: string) => request(app).get(url).set("Cookie", admin.cookie),
  post: (url: string) => request(app).post(url).set("Cookie", admin.cookie).set("Origin", origin),
  patch: (url: string) => request(app).patch(url).set("Cookie", admin.cookie).set("Origin", origin),
  put: (url: string) => request(app).put(url).set("Cookie", admin.cookie).set("Origin", origin),
});

const order = (body: object) => request(app).post("/orders").send({ ...customer, ...body });
const stockOf = async (id: string) => (await prisma.variant.findUniqueOrThrow({ where: { id } })).stock;
const setStock = (id: string, stock: number) => prisma.variant.update({ where: { id }, data: { stock } });
const idOf = async (code: string) => (await prisma.order.findUniqueOrThrow({ where: { code } })).id;

describe("orders", () => {
  before(async () => {
    admin = await loggedInAdmin();
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    savedInstapay = s && { instapayNumber: s.instapayNumber, instapayName: s.instapayName };

    const bags = await prisma.category.findUniqueOrThrow({ where: { slug: "bags" } });
    const bag = await prisma.product.create({
      data: {
        slug: "zzorders-bag", categoryId: bags.id, nameAr: "شنطة اختبار", nameEn: "Test bag", price: 500, discountPercent: 10,
        variants: { create: [{ colorAr: "أحمر", colorEn: "Red", stock: 2 }, { colorAr: "أسود", colorEn: "Black", stock: 1 }] },
      },
      include: { variants: true },
    });
    red = bag.variants.find((v) => v.colorEn === "Red")!.id;
    black = bag.variants.find((v) => v.colorEn === "Black")!.id;
    const mto = await prisma.product.create({
      data: { slug: "zzorders-mto", categoryId: bags.id, nameAr: "بالطلب", nameEn: "Made to order", price: 1000, madeToOrder: true, leadDays: 10, variants: { create: [{}] } },
      include: { variants: true },
    });
    madeToOrder = mto.variants[0].id;
    const hidden = await prisma.product.create({
      data: { slug: "zzorders-hidden", categoryId: bags.id, nameAr: "مخفي", nameEn: "Hidden", price: 100, hidden: true, variants: { create: [{ stock: 5 }] } },
      include: { variants: true },
    });
    hiddenVariant = hidden.variants[0].id;
    await prisma.shippingZone.create({ data: { id: "zzorders-zone", nameAr: "منطقة اختبار", nameEn: "Test zone", price: 50 } });
    await prisma.coupon.create({ data: { code: "ZZORDERS", percent: 10 } });
  });

  after(async () => {
    const orders = await prisma.order.findMany({ where: { name: CUSTOMER }, select: { proofUrl: true } });
    await Promise.all(orders.flatMap((o) => (o.proofUrl ? [removeProof(o.proofUrl)] : [])));
    await prisma.order.deleteMany({ where: { name: CUSTOMER } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "zzorders" } } });
    await prisma.shippingZone.deleteMany({ where: { id: "zzorders-zone" } });
    await prisma.coupon.deleteMany({ where: { code: "ZZORDERS" } });
    await prisma.settings.update({
      where: { id: 1 },
      data: savedInstapay ?? { instapayNumber: "", instapayName: "" },
    });
    const adminRow = await prisma.admin.findUnique({ where: { email: admin.email } });
    if (adminRow) await prisma.auditLog.deleteMany({ where: { adminId: adminRow.id } });
    await admin.remove();
    await prisma.$disconnect();
  });

  it("computes every price on the server and takes the stock", async () => {
    const res = await order({ coupon: "zzorders", items: [{ variantId: red, qty: 2 }], total: 1, subtotal: 1 });
    assert.equal(res.status, 201);
    // 500 - 10% = 450 each, x2 = 900; coupon 10% = 90; shipping 50.
    assert.equal(res.body.subtotal, 900);
    assert.equal(res.body.discount, 90);
    assert.equal(res.body.shipping, 50);
    assert.equal(res.body.total, 860);
    assert.equal(res.body.status, "new");
    assert.match(res.body.code, /^[A-Z2-9]{6}$/);
    assert.ok(res.body.token.length >= 40, "long random token");
    assert.deepEqual(res.body.items, [{ name: "شنطة اختبار", label: "أحمر", qty: 2, unitPrice: 450 }]);
    assert.equal(await stockOf(red), 0);
  });

  it("refuses when the stock is not enough, without taking anything", async () => {
    await setStock(black, 1);
    const res = await order({ items: [{ variantId: black, qty: 1 }, { variantId: red, qty: 1 }] });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: "out_of_stock", variantId: red, available: 0 });
    assert.equal(await stockOf(black), 1, "black was rolled back");
  });

  it("gives the last piece to exactly one of ten customers at the same moment", async () => {
    await setStock(black, 1);
    const results = await Promise.all(Array.from({ length: 10 }, () => order({ items: [{ variantId: black, qty: 1 }] })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
    assert.equal(await stockOf(black), 0, "never below zero");
  });

  it("creates one order when the same order is sent twice", async () => {
    await setStock(black, 3);
    const key = randomUUID();
    const [a, b] = await Promise.all([
      order({ idempotencyKey: key, items: [{ variantId: black, qty: 1 }] }),
      order({ idempotencyKey: key, items: [{ variantId: black, qty: 1 }] }),
    ]);
    const c = await order({ idempotencyKey: key, items: [{ variantId: black, qty: 1 }] });
    assert.equal(a.status, 201);
    assert.equal(b.body.code, a.body.code);
    assert.equal(c.body.code, a.body.code);
    assert.equal(await stockOf(black), 2, "stock taken once");
  });

  it("does not take stock for made-to-order pieces", async () => {
    const res = await order({ items: [{ variantId: madeToOrder, qty: 3 }] });
    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 3000);
    assert.equal(await stockOf(madeToOrder), 0);
  });

  it("refuses hidden products, unknown zones, bad coupons and bad fields", async () => {
    assert.equal((await order({ items: [{ variantId: hiddenVariant, qty: 1 }] })).body.error, "unavailable");
    const zone = await order({ zoneId: "nowhere", items: [{ variantId: madeToOrder, qty: 1 }] });
    assert.deepEqual([zone.status, zone.body.field], [422, "zoneId"]);

    await setStock(black, 1);
    const coupon = await order({ coupon: "NOPE", items: [{ variantId: black, qty: 1 }] });
    assert.deepEqual([coupon.status, coupon.body.field], [422, "coupon"]);
    assert.equal(await stockOf(black), 1, "a refused order takes no stock");

    const phone = await order({ phone: "123", items: [{ variantId: madeToOrder, qty: 1 }] });
    assert.deepEqual([phone.status, phone.body.field], [422, "phone"]);
    const arabic = await order({ phone: "٠١٠ ٠٠٠٠ ٠٠٠٠", items: [{ variantId: madeToOrder, qty: 1 }] });
    assert.equal(arabic.status, 201, "Arabic digits are accepted");
  });

  it("shows an order only with its token", async () => {
    const placed = (await order({ items: [{ variantId: madeToOrder, qty: 1 }] })).body;
    const ok = await request(app).get(`/orders/${placed.code}`).query({ token: placed.token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.total, placed.total);
    assert.equal(ok.body.token, undefined, "token is not repeated");
    assert.equal((await request(app).get(`/orders/${placed.code}`).query({ token: "wrong" })).status, 404);
    assert.equal((await request(app).get(`/orders/${placed.code}`)).status, 404);
  });

  it("lets the dashboard move an order and cancel it, returning stock once", async () => {
    await setStock(black, 2);
    const placed = (await order({ items: [{ variantId: black, qty: 2 }] })).body;
    const id = await idOf(placed.code);
    assert.equal(await stockOf(black), 0);

    assert.equal((await request(app).get("/admin/orders")).status, 401);
    const list = await as().get("/admin/orders").query({ status: "new" });
    assert.ok(list.body.some((o: { code: string }) => o.code === placed.code));

    const shipped = await as().patch(`/admin/orders/${id}`).send({ status: "shipped", paid: true });
    assert.deepEqual([shipped.body.status, shipped.body.paid], ["shipped", true]);

    // Two cancels at the same moment: the pieces come back once.
    const [c1, c2] = await Promise.all([
      as().patch(`/admin/orders/${id}`).send({ status: "cancelled" }),
      as().patch(`/admin/orders/${id}`).send({ status: "cancelled" }),
    ]);
    assert.deepEqual([c1.status, c2.status].sort(), [200, 409]);
    assert.equal(await stockOf(black), 2);

    const reopen = await as().patch(`/admin/orders/${id}`).send({ status: "new" });
    assert.deepEqual([reopen.status, reopen.body.error], [409, "cancelled"]);
  });

  it("runs InstaPay: hidden until set, screenshot required and private, one decision", async () => {
    await prisma.settings.update({ where: { id: 1 }, data: { instapayNumber: "", instapayName: "" } });
    const off = await order({ payment: "instapay", items: [{ variantId: madeToOrder, qty: 1 }] });
    assert.equal(off.body.error, "instapay_off");

    assert.equal((await as().put("/admin/settings/instapay").send({ number: "01011112222", name: "" })).status, 422);
    const set = await as().put("/admin/settings/instapay").send({ number: "01011112222", name: "Aisha Test" });
    assert.equal(set.status, 200);
    assert.deepEqual((await request(app).get("/payment-methods")).body.instapay, { number: "01011112222", name: "Aisha Test" });
    const adminRow = await prisma.admin.findUniqueOrThrow({ where: { email: admin.email } });
    assert.equal(await prisma.auditLog.count({ where: { adminId: adminRow.id, action: "instapay.update" } }), 1, "change is logged");

    const noProof = await order({ payment: "instapay", items: [{ variantId: madeToOrder, qty: 1 }] });
    assert.equal(noProof.body.error, "missing_proof");

    const png = await sharp({ create: { width: 300, height: 600, channels: 3, background: "#fff" } }).png().toBuffer();
    const send = (body: object) =>
      request(app)
        .post("/orders")
        .field("order", JSON.stringify({ ...customer, payment: "instapay", ...body }))
        .attach("proof", png, "transfer.png");

    await setStock(black, 2);
    const placed = (await send({ items: [{ variantId: black, qty: 1 }] })).body;
    assert.deepEqual([placed.status, placed.transfer, placed.paid], ["new", "awaiting", false]);
    assert.equal(await stockOf(black), 1, "stock is held while waiting");
    const id = await idOf(placed.code);

    // The screenshot is not reachable without a session.
    const files = await readdir(proofsDir);
    assert.ok(files.length > 0);
    assert.equal((await request(app).get(`/uploads/private/proofs/${files[0]}`)).status, 404);
    assert.equal((await request(app).get(`/admin/orders/${id}/proof`)).status, 401);
    const proof = await as().get(`/admin/orders/${id}/proof`);
    assert.equal(proof.status, 200);
    assert.equal(proof.headers["content-type"], "image/webp");

    assert.equal((await as().patch(`/admin/orders/${id}`).send({ status: "confirmed" })).body.error, "awaiting_transfer");
    const approved = await as().post(`/admin/orders/${id}/transfer`).send({ approved: true });
    assert.deepEqual([approved.body.transfer, approved.body.paid, approved.body.status], ["approved", true, "confirmed"]);
    assert.equal((await as().post(`/admin/orders/${id}/transfer`).send({ approved: false })).status, 409, "one decision only");

    const second = (await send({ items: [{ variantId: black, qty: 1 }] })).body;
    assert.equal(await stockOf(black), 0);
    const rejected = await as().post(`/admin/orders/${await idOf(second.code)}/transfer`).send({ approved: false });
    assert.deepEqual([rejected.body.transfer, rejected.body.status], ["rejected", "cancelled"]);
    assert.equal(await stockOf(black), 1, "rejecting returns the piece");

    const status = await request(app).get(`/orders/${second.code}`).query({ token: second.token });
    assert.deepEqual([status.body.transfer, status.body.status], ["rejected", "cancelled"]);
  });
});
