"use client";

import { orderStore } from "@/data/admin";
import { myOrderIds } from "@/data/mine";
import { formatPrice } from "@/data/products";
import OrderStatus, { type StatusLabels } from "./OrderStatus";

export default function MyOrders({ lang, t }: { lang: "ar" | "en"; t: StatusLabels }) {
  const ids = myOrderIds.useList();
  const orders = orderStore.useList().filter((o) => ids.includes(o.id));

  if (!orders.length) return <p className="mt-8 text-lg">{t.none}</p>;

  return (
    <ul className="mt-8 space-y-6">
      {orders.map((o) => (
        <li key={o.id} className="rounded-2xl bg-navy-deep p-5">
          <p className="font-bold">
            <bdi className="text-gold">{o.id}</bdi> - {formatPrice(o.total, lang)}
          </p>
          <p className="text-sm opacity-80">{o.lines.map((l) => `${l.name} × ${l.qty}`).join("، ")}</p>
          <OrderStatus id={o.id} t={t} />
        </li>
      ))}
    </ul>
  );
}
