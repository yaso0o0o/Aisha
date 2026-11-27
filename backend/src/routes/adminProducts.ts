// Dashboard products and photo uploads. Mounted after requireAdmin, so every route needs a session.
// Rules from docs/backend-spec.md section 5: at least one variant per product, stock per variant,
// deleting a product that was ordered archives it instead.
import { Prisma } from "@prisma/client";
import { Router, type NextFunction, type Request, type Response } from "express";
import { MulterError } from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { NotAnImage, oneImage, removeUpload, saveProductImage } from "../uploads.js";
import { invalid } from "../validate.js";

export const adminProducts = Router();

const include = {
  category: true,
  images: { orderBy: { sort: "asc" } },
  variants: { orderBy: [{ colorEn: "asc" }, { size: "asc" }] },
} satisfies Prisma.ProductInclude;

type FullProduct = Prisma.ProductGetPayload<{ include: typeof include }>;

const toJson = (p: FullProduct) => ({
  id: p.id,
  slug: p.slug,
  category: p.category.slug,
  nameAr: p.nameAr,
  nameEn: p.nameEn,
  images: p.images.map((i) => i.url),
  price: p.price,
  discount: p.discountPercent,
  madeToOrder: p.madeToOrder,
  leadDays: p.leadDays,
  hidden: p.hidden,
  variants: p.variants.map((v) => ({
    id: v.id,
    colorAr: v.colorAr,
    colorEn: v.colorEn,
    size: v.size,
    stock: v.stock,
  })),
  /** Send back on PATCH so a save never overwrites someone else's newer change. */
  updatedAt: p.updatedAt.toISOString(),
});

const text = (max: number) => z.string().trim().max(max);
// Our own uploads, the photos shipped with the site, or a full https link.
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/uploads\/products\/[a-f0-9]+\.webp|\/products\/[\w-]+\.(webp|jpe?g|png)|https:\/\/\S+)$/);

const variant = z
  .object({
    colorAr: text(60).default(""),
    colorEn: text(60).default(""),
    size: text(20).default(""),
    stock: z.number().int().min(0).max(100_000).default(0),
  })
  .refine((v) => Boolean(v.colorAr) === Boolean(v.colorEn), {
    message: "colour needs both Arabic and English",
    path: ["colorEn"],
  });

const fields = {
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
  category: z.string().trim().min(1),
  nameAr: text(120).min(1),
  nameEn: text(120).default(""),
  images: z.array(imageUrl).max(10),
  price: z.number().int().min(1).max(1_000_000),
  discount: z.number().int().min(0).max(90),
  madeToOrder: z.boolean(),
  leadDays: z.number().int().min(1).max(365).nullable(),
  hidden: z.boolean(),
  variants: z.array(variant).min(1).max(100),
};

const createBody = z.object({
  ...fields,
  slug: fields.slug.optional(),
  nameEn: fields.nameEn,
  images: fields.images.default([]),
  discount: fields.discount.default(0),
  madeToOrder: fields.madeToOrder.default(false),
  leadDays: fields.leadDays.default(null),
  hidden: fields.hidden.default(false),
});

const patchBody = z
  .object({ ...fields, updatedAt: z.string().datetime() })
  .partial()
  .required({ updatedAt: true });

type VariantInput = z.infer<typeof variant>;

/** Two variants with the same colour and size would be the same thing. */
function duplicateVariant(variants: VariantInput[]) {
  const seen = new Set<string>();
  return variants.some((v) => {
    const key = `${v.colorEn.toLowerCase()}|${v.size.toLowerCase()}`;
    return seen.has(key) || !seen.add(key);
  });
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** A free slug from the English name, e.g. "red-bag", "red-bag-2". */
async function freeSlug(base: string) {
  const root = slugify(base) || "product";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    if (!(await prisma.product.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
}

async function categoryId(slug: string) {
  return (await prisma.category.findUnique({ where: { slug }, select: { id: true } }))?.id;
}

/** Deletes uploaded photo files that no product uses any more. */
async function removeUnusedUploads(urls: string[]) {
  for (const url of urls) {
    // removeUpload ignores addresses that are not our own uploads
    if ((await prisma.productImage.count({ where: { url } })) > 0) continue;
    // the product change is already saved: a failed cleanup must not turn it into an error
    await removeUpload(url).catch((e) => console.error("Could not delete photo", url, e));
  }
}

const fail = (res: Response, status: number, error: string, field?: string) =>
  res.status(status).json({ error, ...(field && { field }) });

adminProducts.get("/admin/products", async (_req, res) => {
  const list = await prisma.product.findMany({
    where: { archivedAt: null },
    include,
    orderBy: { createdAt: "desc" },
  });
  res.json(list.map(toJson));
});

adminProducts.get("/admin/products/:id", async (req, res) => {
  const p = await prisma.product.findFirst({ where: { id: req.params.id, archivedAt: null }, include });
  if (!p) return fail(res, 404, "not_found");
  res.json(toJson(p));
});

adminProducts.post("/admin/products", async (req, res) => {
  const body = createBody.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  const d = body.data;
  if (duplicateVariant(d.variants)) return fail(res, 422, "duplicate_variant", "variants");
  const category = await categoryId(d.category);
  if (!category) return fail(res, 422, "unknown_category", "category");
  if (d.slug && (await prisma.product.findUnique({ where: { slug: d.slug } }))) {
    return fail(res, 409, "slug_taken", "slug");
  }

  const p = await prisma.product.create({
    data: {
      slug: d.slug ?? (await freeSlug(d.nameEn || "product")),
      categoryId: category,
      nameAr: d.nameAr,
      nameEn: d.nameEn,
      price: d.price,
      discountPercent: d.discount,
      madeToOrder: d.madeToOrder,
      leadDays: d.madeToOrder ? (d.leadDays ?? 14) : null,
      hidden: d.hidden,
      images: { create: d.images.map((url, sort) => ({ url, sort })) },
      // Made-to-order pieces are never taken from stock.
      variants: { create: d.variants.map((v) => ({ ...v, stock: d.madeToOrder ? 0 : v.stock })) },
    },
    include,
  });
  res.status(201).json(toJson(p));
});

adminProducts.patch("/admin/products/:id", async (req, res) => {
  const body = patchBody.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  const { updatedAt, variants, images, category, discount, ...d } = body.data;
  if (variants && duplicateVariant(variants)) return fail(res, 422, "duplicate_variant", "variants");
  const newCategory = category === undefined ? undefined : await categoryId(category);
  if (category !== undefined && !newCategory) return fail(res, 422, "unknown_category", "category");
  const oldImages = images
    ? (await prisma.productImage.findMany({ where: { productId: req.params.id }, select: { url: true } })).map((i) => i.url)
    : [];

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.product.findFirst({
      where: { id: req.params.id, archivedAt: null },
      include: { variants: true },
    });
    if (!current) return "not_found" as const;
    if (current.updatedAt.toISOString() !== updatedAt) return "changed" as const;
    if (d.slug && d.slug !== current.slug && (await tx.product.findUnique({ where: { slug: d.slug } }))) {
      return "slug_taken" as const;
    }
    const madeToOrder = d.madeToOrder ?? current.madeToOrder;

    // Only the row whose updatedAt still matches is changed, so two saves cannot both win.
    const { count } = await tx.product.updateMany({
      where: { id: current.id, updatedAt: current.updatedAt },
      data: {
        ...d,
        ...(discount !== undefined && { discountPercent: discount }),
        ...(newCategory && { categoryId: newCategory }),
        leadDays: madeToOrder ? (d.leadDays ?? current.leadDays ?? 14) : null,
        updatedAt: new Date(),
      },
    });
    if (count === 0) return "changed" as const;

    if (images) {
      await tx.productImage.deleteMany({ where: { productId: current.id } });
      await tx.productImage.createMany({
        data: images.map((url, sort) => ({ productId: current.id, url, sort })),
      });
    }

    if (variants) {
      // Same colour and size keeps the same variant (and its id in past orders).
      const key = (v: { colorEn: string; size: string }) => `${v.colorEn.toLowerCase()}|${v.size.toLowerCase()}`;
      const existing = new Map(current.variants.map((v) => [key(v), v]));
      const keep = new Set<string>();
      for (const v of variants) {
        const stock = madeToOrder ? 0 : v.stock;
        const old = existing.get(key(v));
        if (old) {
          keep.add(old.id);
          await tx.variant.update({ where: { id: old.id }, data: { ...v, stock } });
        } else {
          await tx.variant.create({ data: { ...v, stock, productId: current.id } });
        }
      }
      await tx.variant.deleteMany({
        where: { productId: current.id, id: { notIn: [...keep] } },
      });
    }

    return tx.product.findUniqueOrThrow({ where: { id: current.id }, include });
  });

  if (result === "not_found") return fail(res, 404, "not_found");
  if (result === "changed") return fail(res, 409, "changed");
  if (result === "slug_taken") return fail(res, 409, "slug_taken", "slug");
  if (images) await removeUnusedUploads(oldImages.filter((url) => !images.includes(url)));
  res.json(toJson(result));
});

adminProducts.delete("/admin/products/:id", async (req, res) => {
  const p = await prisma.product.findFirst({
    where: { id: req.params.id, archivedAt: null },
    select: { id: true, _count: { select: { orderItems: true } } },
  });
  if (!p) return fail(res, 404, "not_found");
  // A product in past orders stays in the database, hidden from the shop and dashboard.
  if (p._count.orderItems > 0) {
    await prisma.product.update({ where: { id: p.id }, data: { archivedAt: new Date(), hidden: true } });
    res.json({ archived: true });
    return;
  }
  const images = await prisma.productImage.findMany({ where: { productId: p.id }, select: { url: true } });
  await prisma.product.delete({ where: { id: p.id } });
  await removeUnusedUploads(images.map((i) => i.url));
  res.json({ archived: false });
});

adminProducts.post(
  "/admin/uploads",
  (req: Request, res: Response, next: NextFunction) => {
    oneImage(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        return fail(res, err.code === "LIMIT_FILE_SIZE" ? 413 : 422, err.code === "LIMIT_FILE_SIZE" ? "too_large" : "bad_upload", "file");
      }
      if (err) return next(err);
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return fail(res, 422, "missing_file", "file");
    try {
      res.status(201).json({ url: await saveProductImage(req.file.buffer) });
    } catch (err) {
      if (err instanceof NotAnImage) return fail(res, 422, "not_an_image", "file");
      throw err;
    }
  },
);
