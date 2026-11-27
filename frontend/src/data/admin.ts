// Orders, coupons, shipping and InstaPay, still kept in this browser only (a demo).
// Products already come from the backend. The backend must take over every function here,
// especially placeOrder: only a server can stop two customers buying the same last piece.
import { createStore } from "./store";

/* ---------- coupons and shipping ---------- */

export type Coupon = { code: string; percent: number; min: number; until: string; active: boolean };
export type Zone = { id: string; nameAr: string; nameEn: string; price: number };

export const couponStore = createStore<Coupon>("aisha-coupons", []);

// Sample shipping prices until the owner sets the real ones.
export const zoneStore = createStore<Zone>("aisha-zones", [
  { id: "cairo", nameAr: "القاهرة والجيزة", nameEn: "Cairo and Giza", price: 60 },
  { id: "alex", nameAr: "الإسكندرية", nameEn: "Alexandria", price: 75 },
  { id: "egypt", nameAr: "باقي المحافظات", nameEn: "Other governorates", price: 100 },
  { id: "world", nameAr: "خارج مصر", nameEn: "Outside Egypt", price: 900 },
]);

/** The coupon for this code if it can be used on this subtotal today. */
export function findCoupon(coupons: Coupon[], code: string, subtotal: number) {
  const today = new Date().toLocaleDateString("en-CA");
  return coupons.find(
    (c) =>
      c.code === code.trim().toUpperCase() &&
      c.active &&
      subtotal >= c.min &&
      (!c.until || c.until >= today),
  );
}

/* ---------- InstaPay ---------- */

/** Set by the owner in the dashboard. InstaPay is offered only when both are filled. */
export type Instapay = { number: string; name: string };

export const instapayStore = createStore<Instapay>("aisha-instapay", []);

/** Where a manual transfer stands until the owner checks the money arrived. */
export type Transfer = "awaiting" | "approved" | "rejected";

/* ---------- orders ---------- */

export const orderStatuses = {
  new: "جديد",
  confirmed: "متأكد",
  shipped: "اتشحن",
  delivered: "اتسلم",
  cancelled: "ملغي",
} as const;

export const payments = { cod: "كاش عند الاستلام", instapay: "InstaPay", wallet: "محفظة" } as const;

export const orderStatusesEn: Record<keyof typeof orderStatuses, string> = {
  new: "New",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const paymentsEn: Record<keyof typeof payments, string> = { cod: "Cash on delivery", instapay: "InstaPay", wallet: "Wallet" };

export type OrderLine = { slug: string; name: string; key: string; label: string; qty: number; price: number };

export type Order = {
  id: string;
  date: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  payment: keyof typeof payments;
  lines: OrderLine[];
  coupon: string;
  discount: number;
  shipping: number;
  total: number;
  status: keyof typeof orderStatuses;
  paid: boolean;
  /** InstaPay only: screenshot of the transfer, and the owner's decision. */
  proof?: string;
  transfer?: Transfer;
};

export const orderStore = createStore<Order>("aisha-orders", []);

export class StockError extends Error {
  constructor(public slug: string) {
    super("out of stock");
  }
}

type NewOrder = Pick<Order, "name" | "phone" | "address" | "payment" | "proof"> & {
  zoneId: string;
  code: string;
  /** Built by the cart from the server prices; key is the variant id. */
  lines: OrderLine[];
};

/**
 * DEMO until POST /orders exists: records the order in this browser only.
 * It does not touch stock; the server will check and take stock in one transaction.
 */
export function placeOrder({ lines, zoneId, code, proof, ...customer }: NewOrder): Order {
  const transfer = customer.payment === "instapay";
  if (transfer && !proof) throw new Error("missing transfer screenshot");

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const coupon = findCoupon(couponStore.refresh(), code, subtotal);
  const discount = coupon ? Math.round((subtotal * coupon.percent) / 100) : 0;
  const zone = zoneStore.refresh().find((z) => z.id === zoneId);
  if (!zone) throw new Error("unknown shipping zone");

  const order: Order = {
    ...customer,
    id: Date.now().toString(36).toUpperCase(),
    date: new Date().toISOString(),
    zone: zone.nameAr,
    lines,
    coupon: coupon?.code ?? "",
    discount,
    shipping: zone.price,
    total: subtotal - discount + zone.price,
    status: "new",
    paid: false,
    ...(transfer ? { proof, transfer: "awaiting" as const } : {}),
  };
  orderStore.write([order, ...orderStore.refresh()]);
  return order;
}

/** The owner's answer on a transfer. Rejecting cancels the order and frees its pieces. */
export function reviewTransfer(id: string, approved: boolean) {
  if (orderStore.refresh().find((o) => o.id === id)?.transfer !== "awaiting") return;
  updateOrder(
    id,
    approved
      ? { transfer: "approved", paid: true, status: "confirmed" }
      : { transfer: "rejected", status: "cancelled" },
  );
}

/** A cancelled order stays cancelled. Stock is returned by the server once orders use it. */
export function updateOrder(id: string, patch: Partial<Pick<Order, "status" | "paid" | "transfer">>) {
  const orders = orderStore.refresh();
  const order = orders.find((o) => o.id === id);
  if (!order || order.status === "cancelled") return;
  orderStore.write(orders.map((o) => (o.id === id ? { ...o, ...patch } : o)));
}
