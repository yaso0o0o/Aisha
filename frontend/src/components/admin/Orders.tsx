"use client";

import { useState } from "react";
import { orderStatuses, orderStatusesEn, orderStore, payments, paymentsEn, updateOrder, type Order } from "@/data/admin";
import { useAdmin } from "./lang";
import { formatPrice } from "@/data/products";
import { field } from "./ProductForm";

export default function Orders() {
  const orders = orderStore.useList();
  const { lang, locale, tr, num } = useAdmin();
  const statuses = lang === "ar" ? orderStatuses : orderStatusesEn;
  const methods = lang === "ar" ? payments : paymentsEn;
  const [filter, setFilter] = useState("");
  const [cancelling, setCancelling] = useState("");
  // transfers still waiting have their own tab
  const checked = orders.filter((o) => o.transfer !== "awaiting" || o.status === "cancelled");
  const shown = checked.filter((o) => !filter || o.status === filter);

  return (
    <>
      <select aria-label={tr("حالة الطلب", "Order status")} className={`${field} !w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">{tr("كل الطلبات", "All orders")} ({num(checked.length)})</option>
        {Object.entries(statuses).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>

      {!shown.length && <p className="mt-6">{tr("مفيش طلبات هنا لسه.", "No orders here yet.")}</p>}

      <ul className="mt-4 space-y-3">
        {shown.map((o) => (
          <li key={o.id} className="rounded-xl bg-white p-4 shadow">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-bold">{tr("طلب", "Order")} <bdi>{o.id}</bdi> · {o.name}</h2>
              <time dateTime={o.date} className="text-sm">{new Date(o.date).toLocaleString(locale)}</time>
            </div>
            <p className="text-sm"><bdi dir="ltr">{o.phone}</bdi> · {o.zone} · {o.address}</p>
            <ul className="my-3 list-inside list-disc text-sm">
              {o.lines.map((l) => (
                <li key={`${l.slug}${l.key}`}>{l.name} ({l.label === "القطعة" ? tr("القطعة", "Item") : l.label}) × {num(l.qty)} = {formatPrice(l.price * l.qty, lang)}</li>
              ))}
            </ul>
            <p className="text-sm">
              {tr("الشحن", "Shipping")} {formatPrice(o.shipping, lang)}
              {o.coupon && <> · {tr("كوبون", "Coupon")} <bdi>{o.coupon}</bdi> {tr("خصم", "saves")} {formatPrice(o.discount, lang)}</>}
              {" · "}{methods[o.payment]}
            </p>
            <p className="font-bold">{tr("الإجمالي", "Total")}: {formatPrice(o.total, lang)}</p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                {tr("الحالة", "Status")}
                <select
                  className={`${field} !mt-0 !w-auto`}
                  value={o.status}
                  disabled={o.status === "cancelled"}
                  onChange={(e) => {
                    const status = e.target.value as Order["status"];
                    if (status === "cancelled") setCancelling(o.id);
                    else updateOrder(o.id, { status });
                  }}
                >
                  {Object.entries(statuses).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input type="checkbox" className="h-5 w-5" checked={o.paid} disabled={o.status === "cancelled" || o.payment === "instapay"} onChange={(e) => updateOrder(o.id, { paid: e.target.checked })} />
                {tr("الفلوس وصلت", "Money received")}
              </label>
            </div>
            {cancelling === o.id && o.status !== "cancelled" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
                <span>{tr("تلغي الطلب؟ القطع هترجع المخزون ومش هينفع ترجعيه.", "Cancel the order? Pieces go back to stock and it cannot be undone.")}</span>
                <button type="button" className="min-h-11 rounded-lg bg-wine px-4 text-linen" onClick={() => { updateOrder(o.id, { status: "cancelled" }); setCancelling(""); }}>{tr("ألغي الطلب", "Cancel order")}</button>
                <button type="button" className="min-h-11 rounded-lg border border-navy/25 px-4" onClick={() => setCancelling("")}>{tr("لأ", "No")}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
