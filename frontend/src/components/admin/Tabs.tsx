"use client";

import { useEffect, useState } from "react";
import { listOrders, type AdminOrder } from "@/data/api";
import Coupons from "./Coupons";
import Dashboard from "./Dashboard";
import { useAdmin } from "./lang";
import Orders from "./Orders";
import Shipping from "./Shipping";
import Transfers from "./Transfers";
import { useServerList } from "./useServerList";

const tabs = {
  products: ["المنتجات", "Products"],
  transfers: ["تحويلات InstaPay", "InstaPay transfers"],
  orders: ["الطلبات", "Orders"],
  coupons: ["الكوبونات", "Coupons"],
  shipping: ["الشحن", "Shipping"],
} as const;

/** New orders show up on their own within a minute. */
const REFRESH_MS = 60_000;

export default function Tabs() {
  const [tab, setTab] = useState<keyof typeof tabs>("products");
  const { items: orders, setItems, failed, reload } = useServerList(listOrders);
  const { tr, num } = useAdmin();

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const replace = (saved: AdminOrder) => setItems((list) => list && list.map((o) => (o.id === saved.id ? saved : o)));
  const list = { orders, failed, reload, onChange: replace };

  const waiting = (o: AdminOrder) => o.transfer === "awaiting" && o.status !== "cancelled";
  const badge: Partial<Record<keyof typeof tabs, number>> = {
    transfers: orders?.filter(waiting).length,
    orders: orders?.filter((o) => o.status === "new" && !waiting(o)).length,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-6 flex flex-wrap gap-2">
        {Object.entries(tabs).map(([id, [ar, en]]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id as keyof typeof tabs);
              if (id === "orders" || id === "transfers") reload();
            }}
            className="min-h-11 rounded-full border border-navy/30 px-5 font-bold aria-pressed:bg-navy aria-pressed:text-linen"
          >
            {tr(ar, en)}
            {!!badge[id as keyof typeof tabs] && ` (${num(badge[id as keyof typeof tabs]!)})`}
          </button>
        ))}
      </nav>
      {tab === "products" && <Dashboard />}
      {tab === "transfers" && <Transfers {...list} />}
      {tab === "orders" && <Orders {...list} />}
      {tab === "coupons" && <Coupons />}
      {tab === "shipping" && <Shipping />}
    </div>
  );
}

/** What the orders and transfers tabs get from Tabs. */
export type OrderListProps = {
  orders: AdminOrder[] | null;
  failed: boolean;
  reload: () => void;
  onChange: (order: AdminOrder) => void;
};
