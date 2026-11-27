// Dashboard shipping zones and coupons. Mounted after requireAdmin.
import { Prisma } from "@prisma/client";
import { Router, type Response } from "express";
import { z } from "zod";
import { dateOnly, normalizeCode } from "../coupons.js";
import { prisma } from "../db.js";
import { invalid } from "../validate.js";

export const adminShop = Router();

const fail = (res: Response, status: number, error: string, field?: string) =>
  res.status(status).json({ error, ...(field && { field }) });

const isUniqueError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const isMissingError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";

/* ---------- shipping zones ---------- */

const zoneJson = (z: Prisma.ShippingZoneGetPayload<object>) => ({
  id: z.id,
  nameAr: z.nameAr,
  nameEn: z.nameEn,
  price: z.price,
  active: z.active,
  sort: z.sort,
});

const zoneFields = {
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().max(80),
  price: z.number().int().min(0).max(100_000),
  active: z.boolean(),
  sort: z.number().int().min(0).max(10_000),
};

const zoneCreate = z.object({
  ...zoneFields,
  id: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(40).optional(),
  nameEn: zoneFields.nameEn.default(""),
  active: zoneFields.active.default(true),
  sort: zoneFields.sort.optional(),
});

const zonePatch = z.object(zoneFields).partial();

/** A readable id like "upper-egypt" from the English name, or "zone-2". */
async function freeZoneId(name: string) {
  const root =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "zone";
  for (let n = 1; ; n++) {
    const id = n === 1 ? root : `${root}-${n}`;
    if (!(await prisma.shippingZone.findUnique({ where: { id } }))) return id;
  }
}

adminShop.get("/admin/shipping-zones", async (_req, res) => {
  const zones = await prisma.shippingZone.findMany({ orderBy: [{ sort: "asc" }, { nameAr: "asc" }] });
  res.json(zones.map(zoneJson));
});

adminShop.post("/admin/shipping-zones", async (req, res) => {
  const body = zoneCreate.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  const { id, sort, ...d } = body.data;
  const last = await prisma.shippingZone.aggregate({ _max: { sort: true } });
  try {
    const zone = await prisma.shippingZone.create({
      data: { ...d, id: id ?? (await freeZoneId(d.nameEn)), sort: sort ?? (last._max.sort ?? -1) + 1 },
    });
    res.status(201).json(zoneJson(zone));
  } catch (e) {
    if (isUniqueError(e)) return fail(res, 409, "id_taken", "id");
    throw e;
  }
});

adminShop.patch("/admin/shipping-zones/:id", async (req, res) => {
  const body = zonePatch.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  try {
    res.json(zoneJson(await prisma.shippingZone.update({ where: { id: req.params.id }, data: body.data })));
  } catch (e) {
    if (isMissingError(e)) return fail(res, 404, "not_found");
    throw e;
  }
});

// Past orders keep the zone's name and price, so deleting a zone never changes them.
adminShop.delete("/admin/shipping-zones/:id", async (req, res) => {
  try {
    await prisma.shippingZone.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    if (isMissingError(e)) return fail(res, 404, "not_found");
    throw e;
  }
});

/* ---------- coupons ---------- */

const couponJson = (c: Prisma.CouponGetPayload<object>) => ({
  id: c.id,
  code: c.code,
  percent: c.percent,
  minTotal: c.minTotal,
  validUntil: c.validUntil ? dateOnly(c.validUntil) : null,
  active: c.active,
});

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "not a real date");

const couponFields = {
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform(normalizeCode),
  percent: z.number().int().min(1).max(90),
  minTotal: z.number().int().min(0).max(1_000_000),
  validUntil: day.nullable(),
  active: z.boolean(),
};

const couponCreate = z.object({
  ...couponFields,
  minTotal: couponFields.minTotal.default(0),
  validUntil: couponFields.validUntil.default(null),
  active: couponFields.active.default(true),
});

const couponPatch = z.object(couponFields).partial();

const toDate = (s: string | null | undefined) => (s === undefined ? undefined : s === null ? null : new Date(`${s}T00:00:00Z`));

adminShop.get("/admin/coupons", async (_req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  res.json(coupons.map(couponJson));
});

adminShop.post("/admin/coupons", async (req, res) => {
  const body = couponCreate.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  try {
    const coupon = await prisma.coupon.create({ data: { ...body.data, validUntil: toDate(body.data.validUntil) } });
    res.status(201).json(couponJson(coupon));
  } catch (e) {
    if (isUniqueError(e)) return fail(res, 409, "code_taken", "code");
    throw e;
  }
});

adminShop.patch("/admin/coupons/:id", async (req, res) => {
  const body = couponPatch.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  try {
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: { ...body.data, validUntil: toDate(body.data.validUntil) },
    });
    res.json(couponJson(coupon));
  } catch (e) {
    if (isUniqueError(e)) return fail(res, 409, "code_taken", "code");
    if (isMissingError(e)) return fail(res, 404, "not_found");
    throw e;
  }
});

// Past orders keep the coupon code and discount, so deleting a coupon never changes them.
adminShop.delete("/admin/coupons/:id", async (req, res) => {
  try {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    if (isMissingError(e)) return fail(res, 404, "not_found");
    throw e;
  }
});
