"use client";

import { useEffect, useState } from "react";
import { getOrder, type CustomerOrder } from "@/data/api";
import { myOrders, rememberOrder } from "@/data/mine";
import { formatPrice } from "@/data/products";
import OrderHistory from "./OrderHistory";
import OrderStatus, { type StatusLabels } from "./OrderStatus";

/** How often the page asks the server again while it is open. */
const REFRESH_MS = 30_000;

/** Orders placed from this browser, read from the server with each order's token. */
export default function MyOrders({ lang, t }: { lang: "ar" | "en"; t: StatusLabels }) {
  const saved = myOrders.useList();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const wanted = saved.map((o) => `${o.code}:${o.token}`).join(",");
  const [copied, setCopied] = useState("");

  // A tracking link opened on another device: keep the order, then drop the secret from the address.
  useEffect(() => {
    const match = /^#track=([A-Z0-9]+)\.([\w-]+)$/.exec(window.location.hash);
    if (!match) return;
    rememberOrder({ code: match[1], token: match[2] });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    let live = true;
    const list = wanted ? wanted.split(",").map((s) => s.split(":") as [string, string]) : [];
    const load = () =>
      Promise.all(list.map(([code, token]) => getOrder(code, token).catch(() => null))).then(
        (found) => live && setOrders(found.filter((o): o is CustomerOrder => o !== null)),
      );
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [wanted]);

  if (!orders) return <p role="status" aria-busy="true" className="mt-8 h-24 animate-pulse rounded-2xl bg-linen/10" />;
  if (!orders.length) return <p className="mt-8 text-lg">{t.none}</p>;

  return (
    <ul className="mt-8 space-y-6">
      {orders.map((o) => (
        <li key={o.code} className="rounded-2xl bg-navy-deep p-5">
          <p className="font-bold">
            <bdi className="text-gold">{o.code}</bdi> - {formatPrice(o.total, lang)}
          </p>
          <p className="text-sm opacity-80">{o.items.map((l) => `${l.name} × ${l.qty}`).join("، ")}</p>
          <OrderStatus order={o} t={t} />
          <OrderHistory history={o.history ?? []} lang={lang} t={t} />
          <button
            type="button"
            className="btn btn-line mt-4"
            onClick={() => {
              const token = saved.find((s) => s.code === o.code)?.token;
              if (!token) return;
              // after "#" the secret never reaches server logs
              const link = `${window.location.origin}/${lang}/orders#track=${o.code}.${token}`;
              navigator.clipboard?.writeText(link).then(() => setCopied(o.code), () => {});
            }}
          >
            {copied === o.code ? t.copied : t.copyLink}
          </button>
          <p className="mt-2 text-sm opacity-70">{t.linkNote}</p>
        </li>
      ))}
    </ul>
  );
}
