"use client";

import type { CustomerOrder } from "@/data/api";

export type StatusLabels = Record<
  | "mine" | "title" | "none" | "awaiting" | "approved" | "rejected"
  | "new" | "confirmed" | "shipped" | "delivered" | "cancelled",
  string
>;

/** Where one order stands, in the customer's words. */
export default function OrderStatus({ order, t }: { order: Pick<CustomerOrder, "status" | "transfer">; t: StatusLabels }) {
  const key =
    order.transfer === "rejected" ? "rejected"
      : order.transfer === "awaiting" ? (order.status === "cancelled" ? "cancelled" : "awaiting")
        : order.transfer === "approved" && order.status === "confirmed" ? "approved"
          : order.status;
  const tone =
    key === "awaiting" || key === "new" ? "border-gold text-gold"
      : key === "rejected" || key === "cancelled" ? "border-linen/40 bg-wine"
        : "border-gold bg-gold text-navy";

  return <p role="status" className={`mt-4 rounded-2xl border-2 p-4 text-lg font-bold ${tone}`}>{t[key]}</p>;
}
