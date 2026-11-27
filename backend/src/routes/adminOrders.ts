// Dashboard orders, InstaPay transfers and the InstaPay account. Mounted after requireAdmin.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { OrderError, orderInclude, reviewTransfer, updateOrder } from "../orders.js";
import { proofPath } from "../uploads.js";
import { invalid } from "../validate.js";
import type { Prisma } from "@prisma/client";

export const adminOrders = Router();

const adminOrder = (o: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) => ({
  id: o.id,
  code: o.code,
  createdAt: o.createdAt.toISOString(),
  name: o.name,
  phone: o.phone,
  address: o.address,
  zone: o.zoneName,
  payment: o.paymentMethod,
  items: o.items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, label: i.label, qty: i.qty, unitPrice: i.unitPrice })),
  subtotal: o.subtotal,
  coupon: o.couponCode,
  discount: o.discount,
  shipping: o.shipping,
  total: o.total,
  status: o.status,
  paid: o.paid,
  transfer: o.transferStatus,
  hasProof: Boolean(o.proofUrl),
});

const listQuery = z.object({
  status: z.enum(["new", "confirmed", "shipped", "delivered", "cancelled"]).optional(),
  transfer: z.enum(["awaiting", "approved", "rejected"]).optional(),
});

adminOrders.get("/admin/orders", async (req, res) => {
  const q = listQuery.safeParse(req.query);
  if (!q.success) return invalid(res, q.error);
  const list = await prisma.order.findMany({
    where: { ...(q.data.status && { status: q.data.status }), ...(q.data.transfer && { transferStatus: q.data.transfer }) },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  res.json(list.map(adminOrder));
});

const patchBody = z
  .object({
    status: z.enum(["new", "confirmed", "shipped", "delivered", "cancelled"]).optional(),
    paid: z.boolean().optional(),
  })
  .refine((b) => b.status !== undefined || b.paid !== undefined, { message: "nothing to change" });

adminOrders.patch("/admin/orders/:id", async (req, res) => {
  const body = patchBody.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  try {
    res.json(adminOrder(await updateOrder(req.params.id, body.data)));
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json(e.body);
    throw e;
  }
});

adminOrders.post("/admin/orders/:id/transfer", async (req, res) => {
  const body = z.object({ approved: z.boolean() }).safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  try {
    const order = await reviewTransfer(req.params.id, body.data.approved);
    await prisma.auditLog.create({
      data: { adminId: req.admin!.id, action: body.data.approved ? "transfer.approve" : "transfer.reject", details: { order: order.code } },
    });
    res.json(adminOrder(order));
  } catch (e) {
    if (e instanceof OrderError) return res.status(e.status).json(e.body);
    throw e;
  }
});

/** The transfer screenshot, only for a logged-in admin and never cached. */
adminOrders.get("/admin/orders/:id/proof", async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, select: { proofUrl: true } });
  const file = order?.proofUrl && proofPath(order.proofUrl);
  if (!file) return res.status(404).json({ error: "not_found" });
  res.set("Cache-Control", "private, no-store");
  res.type("image/webp").sendFile(file, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "not_found" });
  });
});

/* ---------- InstaPay account ---------- */

adminOrders.get("/admin/settings/instapay", async (_req, res) => {
  const s = await prisma.settings.findUnique({ where: { id: 1 } });
  res.json({ number: s?.instapayNumber ?? "", name: s?.instapayName ?? "" });
});

const instapayBody = z
  .object({ number: z.string().trim().max(60), name: z.string().trim().max(100) })
  .refine((b) => Boolean(b.number) === Boolean(b.name), { message: "both or neither", path: ["name"] });

// Only a logged-in admin can change where customers send money, and every change is logged.
adminOrders.put("/admin/settings/instapay", async (req, res) => {
  const body = instapayBody.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);
  const before = await prisma.settings.findUnique({ where: { id: 1 } });
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, instapayNumber: body.data.number, instapayName: body.data.name },
    update: { instapayNumber: body.data.number, instapayName: body.data.name },
  });
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: "instapay.update",
      details: {
        from: { number: before?.instapayNumber ?? "", name: before?.instapayName ?? "" },
        to: { number: s.instapayNumber, name: s.instapayName },
      },
    },
  });
  res.json({ number: s.instapayNumber, name: s.instapayName });
});
