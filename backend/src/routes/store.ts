// Public shop endpoints (no login). Spec section 6, "المتجر".
import { Router } from "express";
import { prisma } from "../db.js";
import { finalPrice } from "../pricing.js";

export const store = Router();

/** Products a customer may see: not hidden, not archived. */
const visible = { hidden: false, archivedAt: null };

store.get("/categories", async (_req, res) => {
  const list = await prisma.category.findMany({ orderBy: { sort: "asc" } });
  res.json(
    list.map((c) => ({ slug: c.slug, name: { ar: c.nameAr, en: c.nameEn }, image: c.imageUrl })),
  );
});

store.get("/products", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const list = await prisma.product.findMany({
    where: { ...visible, ...(category && { category: { slug: category } }) },
    include: { category: true, images: { orderBy: { sort: "asc" } }, variants: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    list.map((p) => ({
      slug: p.slug,
      category: p.category.slug,
      name: { ar: p.nameAr, en: p.nameEn },
      image: p.images[0]?.url ?? null,
      price: p.price,
      discount: p.discountPercent,
      finalPrice: finalPrice(p.price, p.discountPercent),
      madeToOrder: p.madeToOrder,
      soldOut: !p.madeToOrder && p.variants.every((v) => v.stock <= 0),
    })),
  );
});

store.get("/products/:slug", async (req, res) => {
  const p = await prisma.product.findFirst({
    where: { slug: req.params.slug, ...visible },
    include: { category: true, images: { orderBy: { sort: "asc" } }, variants: true },
  });
  if (!p) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    slug: p.slug,
    category: p.category.slug,
    name: { ar: p.nameAr, en: p.nameEn },
    images: p.images.map((i) => i.url),
    price: p.price,
    discount: p.discountPercent,
    finalPrice: finalPrice(p.price, p.discountPercent),
    madeToOrder: p.madeToOrder,
    leadDays: p.leadDays,
    variants: p.variants.map((v) => ({
      id: v.id,
      color: v.colorEn ? { ar: v.colorAr, en: v.colorEn } : null,
      size: v.size || null,
      // Made-to-order pieces never run out.
      stock: p.madeToOrder ? null : v.stock,
    })),
  });
});

store.get("/shipping-zones", async (_req, res) => {
  const zones = await prisma.shippingZone.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
  res.json(zones.map((z) => ({ id: z.id, name: { ar: z.nameAr, en: z.nameEn }, price: z.price })));
});

store.get("/payment-methods", async (_req, res) => {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  // InstaPay is offered only when the owner has set both the number and the name.
  const instapay = s?.instapayNumber && s.instapayName
    ? { number: s.instapayNumber, name: s.instapayName }
    : null;
  res.json({ cod: true, instapay, wallet: true });
});
