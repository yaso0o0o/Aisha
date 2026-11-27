"use client";

import { useState } from "react";
import { orderStore } from "@/data/admin";
import Coupons from "./Coupons";
import Dashboard from "./Dashboard";
import { useAdmin } from "./lang";
import Orders from "./Orders";
import Shipping from "./Shipping";
import Transfers from "./Transfers";

const tabs = {
  products: ["المنتجات", "Products"],
  transfers: ["تحويلات InstaPay", "InstaPay transfers"],
  orders: ["الطلبات", "Orders"],
  coupons: ["الكوبونات", "Coupons"],
  shipping: ["الشحن", "Shipping"],
} as const;
const views = { products: Dashboard, transfers: Transfers, orders: Orders, coupons: Coupons, shipping: Shipping };

export default function Tabs() {
  const [tab, setTab] = useState<keyof typeof tabs>("products");
  const orders = orderStore.useList();
  const { tr, num } = useAdmin();
  const badge: Partial<Record<keyof typeof tabs, number>> = {
    transfers: orders.filter((o) => o.transfer === "awaiting" && o.status !== "cancelled").length,
    orders: orders.filter((o) => o.status === "new" && o.transfer !== "awaiting").length,
  };
  const View = views[tab];

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-6 flex flex-wrap gap-2">
        {Object.entries(tabs).map(([id, [ar, en]]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id as keyof typeof tabs)}
            className="min-h-11 rounded-full border border-navy/30 px-5 font-bold aria-pressed:bg-navy aria-pressed:text-linen"
          >
            {tr(ar, en)}
            {!!badge[id as keyof typeof tabs] && ` (${num(badge[id as keyof typeof tabs]!)})`}
          </button>
        ))}
      </nav>
      <View />
    </div>
  );
}
