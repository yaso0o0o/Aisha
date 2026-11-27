"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, decideTransfer, getInstapay, proofUrl, saveInstapay, type AdminOrder, type InstapayAccount } from "@/data/api";
import { formatPrice } from "@/data/products";
import { field } from "./ProductForm";
import { useAdmin } from "./lang";
import type { OrderListProps } from "./Tabs";

/** The InstaPay number and name customers transfer to. Saved on the server; every change is logged. */
function Account() {
  const { tr } = useAdmin();
  const [saved, setSaved] = useState<InstapayAccount | null>(null);
  const [form, setForm] = useState<InstapayAccount>({ number: "", name: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [loadFailed, setLoadFailed] = useState(false);

  // Load once. (tr is a new function on every render, so it must not be a dependency here,
  // or the saved values would be loaded again and wipe what the owner is typing.)
  useEffect(() => {
    let live = true;
    getInstapay()
      .then((a) => {
        if (!live) return;
        setSaved(a);
        setForm(a);
      })
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const clean = { number: form.number.trim(), name: form.name.trim() };
    if (Boolean(clean.number) !== Boolean(clean.name)) return setMessage(tr("اكتبي الرقم والاسم الاتنين.", "Enter both the number and the name."));
    setBusy(true);
    try {
      const account = await saveInstapay(clean);
      setSaved(account);
      setForm(account);
      setMessage(
        account.number
          ? tr("اتحفظ. هيظهر للي يختار InstaPay.", "Saved. Customers who choose InstaPay will see it.")
          : tr("InstaPay اتشال من طرق الدفع.", "InstaPay was removed from payment options."),
      );
    } catch {
      setMessage(tr("متحفظش. جربي تاني.", "Not saved. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const live = saved?.number && saved.name;

  return (
    <form onSubmit={save} noValidate className="grid gap-3 rounded-xl bg-white p-4 shadow md:grid-cols-2">
      <label className="text-sm font-bold">
        {tr("رقم أو عنوان InstaPay", "InstaPay number or address")}
        <input className={field} dir="ltr" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
      </label>
      <label className="text-sm font-bold">
        {tr("الاسم اللي بيظهر عند التحويل", "Name shown when transferring")}
        <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <button type="submit" disabled={busy || !saved} className="btn bg-navy text-linen disabled:opacity-60 md:justify-self-start">{tr("حفظ", "Save")}</button>
      <p role="status" className="self-center font-bold">
        {message || (loadFailed ? tr("مقدرناش نجيب رقم InstaPay.", "Could not load the InstaPay number.") : live ? tr("الرقم ده محفوظ وظاهر للي يختار InstaPay.", "This number is saved and shown to InstaPay customers.") : tr("InstaPay مش ظاهر للعملاء لحد ما تحفظي رقم واسم.", "InstaPay is hidden from customers until you save a number and name."))}
      </p>
    </form>
  );
}

export default function Transfers({ orders, failed, reload, onChange }: OrderListProps) {
  const [rejecting, setRejecting] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const { lang, locale, tr, num } = useAdmin();
  const waiting = orders?.filter((o) => o.transfer === "awaiting" && o.status !== "cancelled") ?? [];

  async function decide(o: AdminOrder, approved: boolean) {
    setBusy(o.id);
    try {
      onChange(await decideTransfer(o.id, approved));
      setMessage(`${tr("طلب", "Order")} ${o.code}: ${approved ? tr("اتوافق عليه", "approved") : tr("اترفض والقطع رجعت المخزون", "rejected, pieces back in stock")}`);
    } catch (e) {
      setMessage(
        e instanceof ApiError && e.status === 409
          ? tr("الطلب ده اتاخد فيه قرار بالفعل.", "A decision was already made on this order.")
          : tr("القرار متحفظش. جربي تاني.", "The decision was not saved. Try again."),
      );
      reload();
    } finally {
      setBusy("");
      setRejecting("");
    }
  }

  return (
    <>
      <Account />

      <h2 className="mt-8 font-display text-2xl font-bold">{tr("مستنية التأكيد", "Waiting for confirmation")}</h2>
      <p className="text-sm font-bold">{tr("السكرين ممكن تتزور: وافقي بس لما تشوفي الفلوس في حسابك.", "Screenshots can be faked: approve only after you see the money in your account.")}</p>
      <p role="status" className="mt-2 min-h-6 font-bold">{message}</p>
      {failed && <p role="alert" className="font-bold">{tr("مقدرناش نجيب الطلبات من السيرفر.", "Could not load orders from the server.")}</p>}
      {orders && !waiting.length && <p className="mt-2">{tr("مفيش تحويلات مستنية.", "No transfers waiting.")}</p>}

      <ul className="mt-4 space-y-3">
        {waiting.map((o) => (
          <li key={o.id} className="flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow">
            {o.hasProof && (
              <>
                <button
                  type="button"
                  className="shrink-0"
                  aria-label={tr("كبّري السكرين", "Enlarge screenshot")}
                  onClick={(e) => e.currentTarget.nextElementSibling instanceof HTMLDialogElement && e.currentTarget.nextElementSibling.showModal()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private image, needs the admin cookie */}
                  <img src={proofUrl(o.id)} alt={tr("سكرين التحويل", "Transfer screenshot")} className="h-40 w-28 rounded-lg border object-cover" />
                </button>
                <dialog className="m-auto max-h-[90svh] rounded-xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private image, needs the admin cookie */}
                  <img src={proofUrl(o.id)} alt={tr("سكرين التحويل", "Transfer screenshot")} className="max-h-[75svh]" />
                  <form method="dialog" className="text-center">
                    <button className="mt-3 min-h-11 rounded-lg border px-6 font-bold">{tr("قفل", "Close")}</button>
                  </form>
                </dialog>
              </>
            )}
            <div className="min-w-0 flex-1 basis-56">
              <h3 className="font-bold">{tr("طلب", "Order")} <bdi>{o.code}</bdi> · {o.name}</h3>
              <p className="text-sm"><bdi dir="ltr">{o.phone}</bdi> · {new Date(o.createdAt).toLocaleString(locale)}</p>
              <p className="text-sm">{o.items.map((l) => `${l.name} × ${num(l.qty)}`).join(" / ")}</p>
              <p className="my-2 text-xl font-bold">{tr("المطلوب", "Amount due")}: {formatPrice(o.total, lang)}</p>
              {rejecting === o.id ? (
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  <span>{tr("ترفضي؟ الطلب هيتلغي والقطع ترجع المخزون.", "Reject? The order is cancelled and pieces go back to stock.")}</span>
                  <button type="button" disabled={busy === o.id} className="min-h-11 rounded-lg bg-wine px-4 text-linen" onClick={() => decide(o, false)}>{tr("ارفضي", "Reject")}</button>
                  <button type="button" className="min-h-11 rounded-lg border px-4" onClick={() => setRejecting("")}>{tr("لأ", "No")}</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy === o.id} className="min-h-11 rounded-lg bg-navy px-5 font-bold text-linen disabled:opacity-60" onClick={() => decide(o, true)}>{tr("الفلوس وصلت، موافقة", "Money received, approve")}</button>
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
