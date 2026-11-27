// Orders and InstaPay, still kept in this browser only (a demo).
// Products, shipping zones and coupons already come from the backend. The backend must take over every function here,
// especially placeOrder: only a server can stop two customers buying the same last piece.
import { createStore } from "./store";

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
  /** The zone and coupon as the server returned them at checkout. */
  zone: { nameAr: string; price: number };
  coupon: { code: string; discount: number } | null;
  /** Built by the cart from the server prices; key is the variant id. */
  lines: OrderLine[];
};

/**
 * DEMO until POST /orders exists: records the order in this browser only.
 * It does not touch stock; the server will check and take stock in one transaction.
 */
export function placeOrder({ lines, zone, coupon, proof, ...customer }: NewOrder): Order {
  const transfer = customer.payment === "instapay";
  if (transfer && !proof) throw new Error("missing transfer screenshot");

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const discount = coupon?.discount ?? 0;

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
