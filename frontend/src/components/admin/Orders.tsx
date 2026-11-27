"use client";

import { useState } from "react";
import { orderStatuses, orderStatusesEn, payments, paymentsEn } from "@/data/admin";
import { ApiError, patchOrder, type AdminOrder, type OrderStatusName } from "@/data/api";
import { formatPrice } from "@/data/products";
import { useAdmin } from "./lang";
import { field } from "./ProductForm";
import type { OrderListProps } from "./Tabs";

export default function Orders({ orders, failed, reload, onChange }: OrderListProps) {
  const { lang, locale, tr, num } = useAdmin();
  const statuses = lang === "ar" ? orderStatuses : orderStatusesEn;
  const methods = lang === "ar" ? payments : paymentsEn;
  const [filter, setFilter] = useState("");
  const [cancelling, setCancelling] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  if (failed) {
    return (
      <div className="space-y-3">
        <p role="alert" className="font-bold">{tr("مقدرناش نجيب الطلبات من السيرفر.", "Could not load orders from the server.")}</p>
        <button type="button" className="min-h-11 rounded-lg border border-navy/25 px-4 font-bold" onClick={reload}>{tr("جربي تاني", "Try again")}</button>
      </div>
    );
  }
  if (!orders) return <p role="status" className="opacity-70">{tr("بنحمّل الطلبات...", "Loading orders...")}</p>;

  // transfers still waiting have their own tab
  const checked = orders.filter((o) => o.transfer !== "awaiting" || o.status === "cancelled");
  const shown = checked.filter((o) => !filter || o.status === filter);

  async function change(o: AdminOrder, patch: { status?: OrderStatusName; paid?: boolean }) {
    setBusy(o.id);
    try {
      onChange(await patchOrder(o.id, patch));
      setMessage(`${tr("طلب", "Order")} ${o.code}: ${tr("اتحفظ", "saved")}`);
    } catch (e) {
      const error = e instanceof ApiError ? e.body.error : "";
      setMessage(
        error === "cancelled"
          ? tr("الطلب ده اتلغى بالفعل.", "This order was already cancelled.")
          : error === "awaiting_transfer"
            ? tr("الطلب ده مستني قرار التحويل الأول.", "This order is waiting for the transfer decision first.")
            : tr("التعديل متحفظش. جربي تاني.", "The change was not saved. Try again."),
      );
      reload();
    } finally {
      setBusy("");
      setCancelling("");
    }
  }

  return (
    <>
      <select aria-label={tr("حالة الطلب", "Order status")} className={`${field} !w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">{tr("كل الطلبات", "All orders")} ({num(checked.length)})</option>
        {Object.entries(statuses).map(([id, name]) => (
          <option key={id} value={id}>{name}</option>
        ))}
      </select>

      <p role="status" className="mt-3 min-h-6 font-bold">{message}</p>
      {!shown.length && <p className="mt-3">{tr("مفيش طلبات هنا لسه.", "No orders here yet.")}</p>}

      <ul className="mt-2 space-y-3">
        {shown.map((o) => (
          <li key={o.id} className="rounded-xl bg-white p-4 shadow">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-bold">{tr("طلب", "Order")} <bdi>{o.code}</bdi> · {o.name}</h2>
              <time dateTime={o.createdAt} className="text-sm">{new Date(o.createdAt).toLocaleString(locale)}</time>
            </div>
            <p className="text-sm"><bdi dir="ltr">{o.phone}</bdi> · {o.zone} · {o.address}</p>
            <ul className="my-3 list-inside list-disc text-sm">
              {o.items.map((l) => (
                <li key={l.id}>{l.name} ({l.label === "القطعة" ? tr("القطعة", "Item") : l.label}) × {num(l.qty)} = {formatPrice(l.unitPrice * l.qty, lang)}</li>
              ))}
            </ul>
            <p className="text-sm">
              {tr("الشحن", "Shipping")} {formatPrice(o.shipping, lang)}
              {o.coupon && <> · {tr("كوبون", "Coupon")} <bdi>{o.coupon}</bdi> {tr("خصم", "saves")} {formatPrice(o.discount, lang)}</>}
              {" · "}{methods[o.payment]}
              {o.transfer === "approved" && ` · ${tr("التحويل اتأكد", "Transfer approved")}`}
              {o.transfer === "rejected" && ` · ${tr("التحويل اترفض", "Transfer rejected")}`}
            </p>
            <p className="font-bold">{tr("الإجمالي", "Total")}: {formatPrice(o.total, lang)}</p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                {tr("الحالة", "Status")}
                <select
                  className={`${field} !mt-0 !w-auto`}
                  value={o.status}
                  disabled={o.status === "cancelled" || busy === o.id}
                  onChange={(e) => {
                    const status = e.target.value as OrderStatusName;
                    if (status === "cancelled") setCancelling(o.id);
                    else change(o, { status });
                  }}
                >
                  {Object.entries(statuses).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={o.paid}
                  disabled={o.status === "cancelled" || o.payment === "instapay" || busy === o.id}
                  onChange={(e) => change(o, { paid: e.target.checked })}
                />
                {tr("الفلوس وصلت", "Money received")}
              </label>
            </div>
            {cancelling === o.id && o.status !== "cancelled" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold">
                <span>{tr("تلغي الطلب؟ القطع هترجع المخزون ومش هينفع ترجعيه.", "Cancel the order? Pieces go back to stock and it cannot be undone.")}</span>
                <button type="button" disabled={busy === o.id} className="min-h-11 rounded-lg bg-wine px-4 text-linen" onClick={() => change(o, { status: "cancelled" })}>{tr("ألغي الطلب", "Cancel order")}</button>
                <button type="button" className="min-h-11 rounded-lg border border-navy/25 px-4" onClick={() => setCancelling("")}>{tr("لأ", "No")}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
