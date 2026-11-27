"use client";

import { useState, type FormEvent } from "react";
import { instapayStore, orderStore, reviewTransfer, type Instapay } from "@/data/admin";
import { formatPrice } from "@/data/products";
import { field } from "./ProductForm";
import { useAdmin } from "./lang";

function Account({ saved }: { saved: Instapay | undefined }) {
  const [number, setNumber] = useState(saved?.number ?? "");
  const [name, setName] = useState(saved?.name ?? "");
  const [message, setMessage] = useState("");
  const { tr } = useAdmin();

  function save(e: FormEvent) {
    e.preventDefault();
    const clean = { number: number.trim(), name: name.trim() };
    if (!clean.number && !clean.name) {
      instapayStore.write([]);
      return setMessage(tr("InstaPay اتشال من طرق الدفع.", "InstaPay was removed from payment options."));
    }
    if (!clean.number || !clean.name) return setMessage(tr("اكتبي الرقم والاسم الاتنين.", "Enter both the number and the name."));
    instapayStore.write([clean]);
    setMessage(tr("اتحفظ. هيظهر للي يختار InstaPay.", "Saved. Customers who choose InstaPay will see it."));
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-3 rounded-xl bg-white p-4 shadow md:grid-cols-2">
      <label className="text-sm font-bold">
        {tr("رقم أو عنوان InstaPay", "InstaPay number or address")}
        <input className={field} dir="ltr" value={number} onChange={(e) => setNumber(e.target.value)} />
      </label>
      <label className="text-sm font-bold">
        {tr("الاسم اللي بيظهر عند التحويل", "Name shown when transferring")}
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit" className="btn bg-navy text-linen md:justify-self-start">{tr("حفظ", "Save")}</button>
      <p role="status" className="self-center font-bold">{message || (saved ? tr("الرقم ده محفوظ وظاهر للي يختار InstaPay.", "This number is saved and shown to InstaPay customers.") : tr("InstaPay مش ظاهر للعملاء لحد ما تحفظي رقم واسم.", "InstaPay is hidden from customers until you save a number and name."))}</p>
    </form>
  );
}

export default function Transfers() {
  const account = instapayStore.useList()[0];
  const waiting = orderStore.useList().filter((o) => o.transfer === "awaiting" && o.status !== "cancelled");
  const [rejecting, setRejecting] = useState("");
  const { lang, locale, tr, num } = useAdmin();

  return (
    <>
      <Account key={account?.number ?? ""} saved={account} />

      <h2 className="mt-8 font-display text-2xl font-bold">{tr("مستنية التأكيد", "Waiting for confirmation")}</h2>
      <p className="text-sm font-bold">{tr("السكرين ممكن تتزور: وافقي بس لما تشوفي الفلوس في حسابك.", "Screenshots can be faked: approve only after you see the money in your account.")}</p>
      {!waiting.length && <p className="mt-4">{tr("مفيش تحويلات مستنية.", "No transfers waiting.")}</p>}

      <ul className="mt-4 space-y-3">
        {waiting.map((o) => (
          <li key={o.id} className="flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow">
            <button
              type="button"
              className="shrink-0"
              aria-label={tr("كبّري السكرين", "Enlarge screenshot")}
              onClick={(e) => e.currentTarget.nextElementSibling instanceof HTMLDialogElement && e.currentTarget.nextElementSibling.showModal()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
              <img src={o.proof} alt={tr("سكرين التحويل", "Transfer screenshot")} className="h-40 w-28 rounded-lg border object-cover" />
            </button>
            <dialog className="m-auto max-h-[90svh] rounded-xl p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
              <img src={o.proof} alt={tr("سكرين التحويل", "Transfer screenshot")} className="max-h-[75svh]" />
              <form method="dialog" className="text-center">
                <button className="mt-3 min-h-11 rounded-lg border px-6 font-bold">{tr("قفل", "Close")}</button>
              </form>
            </dialog>
            <div className="min-w-0 flex-1 basis-56">
              <h3 className="font-bold">{tr("طلب", "Order")} <bdi>{o.id}</bdi> · {o.name}</h3>
              <p className="text-sm"><bdi dir="ltr">{o.phone}</bdi> · {new Date(o.date).toLocaleString(locale)}</p>
              <p className="text-sm">{o.lines.map((l) => `${l.name} × ${num(l.qty)}`).join(" / ")}</p>
              <p className="my-2 text-xl font-bold">{tr("المطلوب", "Amount due")}: {formatPrice(o.total, lang)}</p>
              {rejecting === o.id ? (
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  <span>{tr("ترفضي؟ الطلب هيتلغي والقطع ترجع المخزون.", "Reject? The order is cancelled and pieces go back to stock.")}</span>
                  <button type="button" className="min-h-11 rounded-lg bg-wine px-4 text-linen" onClick={() => reviewTransfer(o.id, false)}>{tr("ارفضي", "Reject")}</button>
                  <button type="button" className="min-h-11 rounded-lg border px-4" onClick={() => setRejecting("")}>{tr("لأ", "No")}</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-lg bg-navy px-5 font-bold text-linen" onClick={() => reviewTransfer(o.id, true)}>{tr("الفلوس وصلت، موافقة", "Money received, approve")}</button>
                  <button type="button" className="min-h-11 rounded-lg border border-wine px-5 font-bold text-wine" onClick={() => setRejecting(o.id)}>{tr("رفض", "Reject")}</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
