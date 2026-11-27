"use client";

import { orderStore } from "@/data/admin";

export type StatusLabels = Record<
  | "mine" | "title" | "none" | "awaiting" | "approved" | "rejected"
  | "new" | "confirmed" | "shipped" | "delivered" | "cancelled",
  string
>;

/** Live state of one order; it changes as soon as the dashboard decides. */
export default function OrderStatus({ id, t }: { id: string; t: StatusLabels }) {
  const order = orderStore.useList().find((o) => o.id === id);
  if (!order) return null;

  const key =
    order.transfer === "rejected" || order.transfer === "awaiting"
      ? order.status === "cancelled" && order.transfer === "awaiting" ? "cancelled" : order.transfer
      : order.transfer === "approved" && order.status === "confirmed"
        ? "approved"
        : order.status;
  const tone =
    key === "awaiting" || key === "new" ? "border-gold text-gold"
      : key === "rejected" || key === "cancelled" ? "border-linen/40 bg-wine"
        : "border-gold bg-gold text-navy";

  return <p role="status" className={`mt-4 rounded-2xl border-2 p-4 text-lg font-bold ${tone}`}>{t[key]}</p>;
}
