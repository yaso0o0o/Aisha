// Placing and changing orders. Rules from docs/backend-spec.md section 5:
// - stock check, stock taken and order saved in ONE transaction
// - two customers can never get the same last piece (conditional decrement)
// - the server computes every price; nothing is taken from the browser
// - name and price are copied into the order at purchase time
// - a cancel returns stock exactly once; a cancelled order never reopens
// - a double click creates one order (idempotency key)
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, type OrderStatus, type PaymentMethod } from "@prisma/client";
import { couponProblem, couponDiscount, normalizeCode } from "./coupons.js";
import { prisma } from "./db.js";
import { finalPrice } from "./pricing.js";

export class OrderError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(String(body.error));
  }
}

export type NewOrder = {
  name: string;
  phone: string;
  address: string;
  zoneId: string;
  payment: PaymentMethod;
  coupon: string;
  items: { variantId: string; qty: number }[];
  idempotencyKey?: string;
  /** Private file name of the InstaPay screenshot, already saved. */
  proof?: string;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I

const newCode = () =>
  Array.from(randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");

/** What the customer may see about their order. */
export const orderInclude = {
  items: true,
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;
type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export const publicOrder = (o: FullOrder) => ({
  code: o.code,
  status: o.status,
  transfer: o.transferStatus,
  paid: o.paid,
  payment: o.paymentMethod,
  zone: o.zoneName,
  subtotal: o.subtotal,
  discount: o.discount,
  coupon: o.couponCode,
  shipping: o.shipping,
  total: o.total,
  items: o.items.map((i) => ({ name: i.name, label: i.label, qty: i.qty, unitPrice: i.unitPrice })),
  createdAt: o.createdAt.toISOString(),
  history: o.events.map((e) => ({ kind: e.kind, at: e.createdAt.toISOString() })),
});

/** Returns the existing order for this key, if the customer already sent it. */
async function existingByKey(key: string | undefined) {
  if (!key) return null;
  return prisma.order.findUnique({ where: { idempotencyKey: key }, include: orderInclude });
}

export async function placeOrder(input: NewOrder) {
  const again = await existingByKey(input.idempotencyKey);
  if (again) return again;

  // The same variant twice in one order counts as one line.
  const wanted = new Map<string, number>();
  for (const i of input.items) wanted.set(i.variantId, (wanted.get(i.variantId) ?? 0) + i.qty);

  const zone = await prisma.shippingZone.findFirst({ where: { id: input.zoneId, active: true } });
  if (!zone) throw new OrderError(422, { error: "unknown_zone", field: "zoneId" });

  if (input.payment === "instapay") {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!s?.instapayNumber || !s.instapayName) throw new OrderError(422, { error: "instapay_off", field: "payment" });
    if (!input.proof) throw new OrderError(422, { error: "missing_proof", field: "proof" });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Sorted ids: concurrent orders lock rows in the same order and cannot deadlock.
      const ids = [...wanted.keys()].sort();
      const variants = await tx.variant.findMany({ where: { id: { in: ids } }, include: { product: true } });
      const byId = new Map(variants.map((v) => [v.id, v]));

      const lines = [];
      for (const id of ids) {
        const v = byId.get(id);
        if (!v || v.product.hidden || v.product.archivedAt) {
          throw new OrderError(409, { error: "unavailable", variantId: id });
        }
        const qty = wanted.get(id)!;
        const takeStock = !v.product.madeToOrder;
        if (takeStock) {
          // Takes the pieces only if they are still there. Two customers racing for the
          // last piece both run this; the database lets exactly one of them succeed.
          const { count } = await tx.variant.updateMany({
            where: { id, stock: { gte: qty } },
            data: { stock: { decrement: qty } },
          });
          if (count === 0) {
            const now = await tx.variant.findUnique({ where: { id }, select: { stock: true } });
            throw new OrderError(409, { error: "out_of_stock", variantId: id, available: now?.stock ?? 0 });
          }
        }
        lines.push({
          productId: v.productId,
          variantId: v.id,
          name: v.product.nameAr,
          label: [v.colorAr, v.size].filter(Boolean).join(" / ") || "القطعة",
          unitPrice: finalPrice(v.product.price, v.product.discountPercent),
          qty,
          stockTaken: takeStock,
        });
      }

      // A dashboard save started before this order must not overwrite the new stock.
      await tx.product.updateMany({
        where: { id: { in: [...new Set(variants.map((v) => v.productId))] } },
        data: { updatedAt: new Date() },
      });

      const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
      let discount = 0;
      let couponCode: string | null = null;
      if (input.coupon.trim()) {
        const coupon = await tx.coupon.findUnique({ where: { code: normalizeCode(input.coupon) } });
        const problem = couponProblem(coupon, subtotal);
        if (problem) throw new OrderError(422, { error: "invalid_coupon", field: "coupon", reason: problem });
        discount = couponDiscount(subtotal, coupon!.percent);
        couponCode = coupon!.code;
      }

      const transfer = input.payment === "instapay";
      // Postgres stops a transaction after any error, so pick a free code before inserting.
      // (32^6 is about a billion codes, so a clash is already very unlikely.)
      let code = newCode();
      while (await tx.order.findUnique({ where: { code }, select: { id: true } })) code = newCode();
      return tx.order.create({
        data: {
          code,
          accessToken: randomBytes(32).toString("base64url"),
          idempotencyKey: input.idempotencyKey,
          name: input.name,
          phone: input.phone,
          address: input.address,
          zoneId: zone.id,
          zoneName: zone.nameAr,
          paymentMethod: input.payment,
          subtotal,
          discount,
          couponCode,
          shipping: zone.price,
          total: subtotal - discount + zone.price,
          transferStatus: transfer ? "awaiting" : null,
          proofUrl: transfer ? input.proof : null,
          items: { create: lines },
          events: { create: { kind: "new" } },
        },
        include: orderInclude,
      });
    });
  } catch (e) {
    // The same key sent twice at the same moment: the second one gets the first one's order.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target).includes("idempotency")) {
      const first = await existingByKey(input.idempotencyKey);
      if (first) return first;
    }
    throw e;
  }
}

/** The order for this code, only when the token matches. */
export async function findOrderForCustomer(code: string, token: string) {
  const order = await prisma.order.findUnique({ where: { code: code.toUpperCase() }, include: orderInclude });
  if (!order) return null;
  const a = Buffer.from(order.accessToken);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? order : null;
}

type Tx = Prisma.TransactionClient;

/**
 * Cancels an order and puts its pieces back, exactly once: only the call that sets
 * stockReturnedAt returns stock, so two clicks or two admins cannot return it twice.
 */
async function cancelInTx(tx: Tx, orderId: string, extra: Prisma.OrderUpdateManyMutationInput = {}) {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: { not: "cancelled" }, stockReturnedAt: null },
    data: { ...extra, status: "cancelled", stockReturnedAt: new Date() },
  });
  if (count === 0) return false;
  // a rejected transfer says why the order stopped; otherwise it was cancelled
  await tx.orderEvent.create({ data: { orderId, kind: extra.transferStatus === "rejected" ? "rejected" : "cancelled" } });
  const items = await tx.orderItem.findMany({ where: { orderId, stockTaken: true, variantId: { not: null } } });
  for (const item of items) {
    await tx.variant.updateMany({ where: { id: item.variantId! }, data: { stock: { increment: item.qty } } });
  }
  const productIds = [...new Set(items.flatMap((i) => (i.productId ? [i.productId] : [])))];
  await tx.product.updateMany({ where: { id: { in: productIds } }, data: { updatedAt: new Date() } });
  return true;
}

/** Dashboard change of status or paid. A cancelled order stays cancelled. */
export async function updateOrder(id: string, patch: { status?: OrderStatus; paid?: boolean }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new OrderError(404, { error: "not_found" });
    if (order.status === "cancelled") throw new OrderError(409, { error: "cancelled" });
    if (order.transferStatus === "awaiting" && (patch.status !== undefined || patch.paid !== undefined) && patch.status !== "cancelled") {
      // An InstaPay order waits for the transfer decision first.
      throw new OrderError(409, { error: "awaiting_transfer" });
    }
    if (patch.paid !== undefined && order.paymentMethod === "instapay") {
      throw new OrderError(409, { error: "paid_by_transfer_review" });
    }

    if (patch.status === "cancelled") {
      const { status: _s, ...rest } = patch;
      const cancelled = await cancelInTx(tx, id, {
        ...rest,
        ...(order.transferStatus === "awaiting" && { transferStatus: "rejected" }),
      });
      // Someone else cancelled it a moment ago; their cancel already returned the stock.
      if (!cancelled) throw new OrderError(409, { error: "cancelled" });
    } else {
      const { count } = await tx.order.updateMany({
        where: { id, status: { not: "cancelled" } },
        data: patch,
      });
      if (count === 0) throw new OrderError(409, { error: "cancelled" });
      // only a real change of status goes in the history, not "money received" ticks
      if (patch.status !== undefined && patch.status !== order.status) {
        await tx.orderEvent.create({ data: { orderId: id, kind: patch.status } });
      }
    }
    return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  });
}

/** The owner's one decision on a waiting InstaPay transfer. */
export async function reviewTransfer(id: string, approved: boolean) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new OrderError(404, { error: "not_found" });
    if (order.transferStatus !== "awaiting" || order.status === "cancelled") {
      throw new OrderError(409, { error: "already_decided" });
    }
    if (approved) {
      const { count } = await tx.order.updateMany({
        where: { id, transferStatus: "awaiting", status: { not: "cancelled" } },
        data: { transferStatus: "approved", paid: true, status: "confirmed" },
      });
      if (count === 0) throw new OrderError(409, { error: "already_decided" });
      await tx.orderEvent.create({ data: { orderId: id, kind: "approved" } });
    } else if (!(await cancelInTx(tx, id, { transferStatus: "rejected" }))) {
      throw new OrderError(409, { error: "already_decided" });
    }
    return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  });
}
