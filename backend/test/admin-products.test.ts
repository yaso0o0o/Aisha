// Dashboard products and photo uploads, against the local database.
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { productsDir } from "../src/uploads.js";
import { loggedInAdmin, origin } from "./helpers.js";

let admin: Awaited<ReturnType<typeof loggedInAdmin>>;
const uploaded: string[] = [];

const as = () => ({
  get: (url: string) => request(app).get(url).set("Cookie", admin.cookie),
  post: (url: string) => request(app).post(url).set("Cookie", admin.cookie).set("Origin", origin),
  patch: (url: string) => request(app).patch(url).set("Cookie", admin.cookie).set("Origin", origin),
  del: (url: string) => request(app).delete(url).set("Cookie", admin.cookie).set("Origin", origin),
});

const base = {
  category: "bags",
  nameAr: "شنطة اختبار",
  nameEn: "ZZ Test Bag",
  price: 500,
  variants: [
    { colorAr: "أحمر", colorEn: "Red", size: "", stock: 2 },
    { colorAr: "أسود", colorEn: "Black", size: "", stock: 0 },
  ],
};

describe("admin products", () => {
  before(async () => {
    admin = await loggedInAdmin();
  });

  after(async () => {
    await prisma.orderItem.deleteMany({ where: { name: "zz-test-item" } });
    await prisma.order.deleteMany({ where: { code: { startsWith: "ZZTEST" } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: "zz-test" } } });
    await Promise.all(uploaded.map((url) => rm(path.join(productsDir, path.basename(url)), { force: true })));
    await admin.remove();
    await prisma.$disconnect();
  });

  it("needs a session for every product and upload route", async () => {
    assert.equal((await request(app).get("/admin/products")).status, 401);
    const up = await request(app).post("/admin/uploads").set("Origin", origin).attach("file", Buffer.from("x"), "a.png");
    assert.equal(up.status, 401);
  });

  it("uploads a photo as WebP and serves it", async () => {
    const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#c33" } }).png().toBuffer();
    const res = await as().post("/admin/uploads").attach("file", png, "photo.png");
    assert.equal(res.status, 201);
    assert.match(res.body.url, /^\/uploads\/products\/[a-f0-9]+\.webp$/);
    uploaded.push(res.body.url);

    const file = await request(app).get(res.body.url).buffer(true).parse((r, done) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => done(null, Buffer.concat(chunks)));
    });
    assert.equal(file.status, 200);
    assert.equal(file.headers["content-type"], "image/webp");
    const meta = await sharp(file.body as Buffer).metadata();
    assert.equal(meta.width, 1600, "long side is shrunk to 1600");
  });

  it("refuses a file that is not an image, and one that is too big", async () => {
    const fake = await as().post("/admin/uploads").attach("file", Buffer.from("<script>alert(1)</script>"), "x.png");
    assert.equal(fake.status, 422);
    assert.equal(fake.body.error, "not_an_image");
    const big = await as().post("/admin/uploads").attach("file", Buffer.alloc(9 * 1024 * 1024), "big.png");
    assert.equal(big.status, 413);
    const none = await as().post("/admin/uploads");
    assert.equal(none.status, 422);
  });

  it("creates a product with a slug from the English name", async () => {
    const res = await as().post("/admin/products").send(base);
    assert.equal(res.status, 201);
    assert.equal(res.body.slug, "zz-test-bag");
    assert.equal(res.body.variants.length, 2);
    const again = await as().post("/admin/products").send(base);
    assert.equal(again.body.slug, "zz-test-bag-2");
  });

  it("refuses bad products with the field name", async () => {
    const cases: [object, string][] = [
      [{ ...base, variants: [] }, "variants"],
      [{ ...base, category: "nope" }, "category"],
      [{ ...base, price: 0 }, "price"],
      [{ ...base, discount: 95 }, "discount"],
      [{ ...base, variants: [{ colorAr: "أحمر", colorEn: "", stock: 1 }] }, "variants.0.colorEn"],
      [{ ...base, variants: [{ colorEn: "Red", colorAr: "أحمر" }, { colorEn: "red", colorAr: "أحمر" }] }, "variants"],
      [{ ...base, images: ["javascript:alert(1)"] }, "images.0"],
    ];
    for (const [body, field] of cases) {
      const res = await as().post("/admin/products").send(body);
      assert.equal(res.status, 422, `422 for ${field}`);
      assert.equal(res.body.field, field);
    }
  });

  it("keeps no stock for made-to-order products", async () => {
    const res = await as().post("/admin/products").send({ ...base, slug: "zz-test-mto", madeToOrder: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.leadDays, 14);
    assert.ok(res.body.variants.every((v: { stock: number }) => v.stock === 0));
  });

  it("shows hidden products in the dashboard but not in the shop", async () => {
    await as().post("/admin/products").send({ ...base, slug: "zz-test-hidden", hidden: true });
    const shop = await request(app).get("/products/zz-test-hidden");
    assert.equal(shop.status, 404);
    const list = await as().get("/admin/products");
    assert.ok(list.body.some((p: { slug: string }) => p.slug === "zz-test-hidden"));
  });

  it("edits a product, keeping variant ids and refusing stale saves", async () => {
    const created = (await as().post("/admin/products").send({ ...base, slug: "zz-test-edit" })).body;
    const red = created.variants.find((v: { colorEn: string }) => v.colorEn === "Red");

    const res = await as().patch(`/admin/products/${created.id}`).send({
      updatedAt: created.updatedAt,
      price: 650,
      discount: 10,
      variants: [
        { colorAr: "أحمر", colorEn: "Red", stock: 5 },
        { colorAr: "أخضر", colorEn: "Green", stock: 1 },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.price, 650);
    assert.equal(res.body.discount, 10);
    const rows = res.body.variants.map((v: { id: string; colorEn: string; stock: number }) => [v.colorEn, v.id, v.stock]);
    assert.deepEqual(rows.find((x: unknown[]) => x[0] === "Red"), ["Red", red.id, 5]);
    assert.ok(!rows.some((x: unknown[]) => x[0] === "Black"), "removed variant is gone");

    const stale = await as().patch(`/admin/products/${created.id}`).send({ updatedAt: created.updatedAt, price: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, "changed");

    const shop = await request(app).get("/products/zz-test-edit");
    assert.equal(shop.body.finalPrice, 585);
  });

  it("deletes photo files no product uses any more", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#123" } }).png().toBuffer();
    const upload = async () => (await as().post("/admin/uploads").attach("file", png, "p.png")).body.url as string;
    const [a, b] = [await upload(), await upload()];
    uploaded.push(a, b);
    const onDisk = async (url: string) => (await request(app).get(url)).status === 200;

    const p = (await as().post("/admin/products").send({ ...base, slug: "zz-test-photos", images: [a, b] })).body;
    const edited = await as().patch(`/admin/products/${p.id}`).send({ updatedAt: p.updatedAt, images: [b] });
    assert.equal(edited.status, 200);
    assert.equal(await onDisk(a), false, "removed photo is deleted");
    assert.equal(await onDisk(b), true, "kept photo stays");

    await as().del(`/admin/products/${p.id}`);
    assert.equal(await onDisk(b), false, "photos go with the deleted product");
  });

  it("deletes an unordered product and archives an ordered one", async () => {
    const fresh = (await as().post("/admin/products").send({ ...base, slug: "zz-test-del" })).body;
    const del = await as().del(`/admin/products/${fresh.id}`);
    assert.deepEqual(del.body, { archived: false });
    assert.equal(await prisma.product.count({ where: { id: fresh.id } }), 0);

    const sold = (await as().post("/admin/products").send({ ...base, slug: "zz-test-sold" })).body;
    await prisma.order.create({
      data: {
        code: "ZZTEST1",
        accessToken: "zz-test-token",
        name: "Test",
        phone: "01000000000",
        address: "Test",
        zoneName: "Test",
        paymentMethod: "cod",
        subtotal: 500,
        shipping: 0,
        total: 500,
        items: { create: { productId: sold.id, variantId: sold.variants[0].id, name: "zz-test-item", unitPrice: 500, qty: 1 } },
      },
    });
    const archive = await as().del(`/admin/products/${sold.id}`);
    assert.deepEqual(archive.body, { archived: true });
    assert.equal(await prisma.product.count({ where: { id: sold.id } }), 1, "kept for the order");
    const list = await as().get("/admin/products");
    assert.ok(!list.body.some((p: { id: string }) => p.id === sold.id), "not in the dashboard");
    assert.equal((await request(app).get("/products/zz-test-sold")).status, 404, "not in the shop");
  });
});
