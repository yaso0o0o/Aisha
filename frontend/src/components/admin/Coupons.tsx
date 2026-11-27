"use client";

import { useState, type FormEvent } from "react";
import { ApiError, createCoupon, deleteCoupon, listCoupons, updateCoupon, type AdminCoupon } from "@/data/api";
import { field } from "./ProductForm";
import { useAdmin } from "./lang";
import { useServerList } from "./useServerList";

const empty = { code: "", percent: "", min: "", until: "" };
const button = "min-h-11 rounded-lg border border-navy/25 px-4 font-bold";

export default function Coupons() {
  const { items: coupons, setItems, failed, reload } = useServerList(listCoupons);
  const { tr, num } = useAdmin();
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const percent = Number(form.percent);
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      return setMessage(tr("الكود من حرفين لـ 30، حروف إنجليزي وأرقام بس.", "The code is 2 to 30 English letters or numbers."));
    }
    if (!(percent >= 1 && percent <= 90)) return setMessage(tr("نسبة الخصم من 1 لـ 90.", "The discount must be between 1 and 90."));
    setBusy(true);
    try {
      const saved = await createCoupon({ code, percent: Math.floor(percent), minTotal: Math.floor(Number(form.min) || 0), validUntil: form.until || null });
      setItems((list) => list && [saved, ...list]);
      setForm(empty);
      setMessage(`${saved.code}: ${tr("اتضاف", "added")}`);
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 409
          ? tr("الكود ده موجود بالفعل.", "This code already exists.")
          : tr("الكوبون متضافش. جربي تاني.", "The coupon was not added. Try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: AdminCoupon) {
    try {
      const saved = await updateCoupon(c.id, { active: !c.active });
      setItems((list) => list && list.map((x) => (x.id === c.id ? saved : x)));
    } catch {
      setMessage(tr("التعديل متحفظش. جربي تاني.", "The change was not saved. Try again."));
      reload();
    }
  }

  async function remove(c: AdminCoupon) {
    if (!confirm(`${tr("تمسحي الكوبون", "Delete coupon")} ${c.code}?`)) return;
    try {
      await deleteCoupon(c.id);
      setItems((list) => list && list.filter((x) => x.id !== c.id));
      setMessage(`${c.code}: ${tr("اتمسح", "deleted")}`);
    } catch {
      setMessage(tr("الكوبون متمسحش. جربي تاني.", "The coupon was not deleted. Try again."));
    }
  }

  const input = (key: keyof typeof empty, label: string, type = "text") => (
    <label className="text-sm font-bold">
      {label}
      <input className={field} type={type} dir={key === "code" ? "ltr" : undefined} min={type === "number" ? 0 : undefined} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  if (failed) {
    return (
      <div className="space-y-3">
        <p role="alert" className="font-bold">{tr("مقدرناش نجيب الكوبونات من السيرفر.", "Could not load coupons from the server.")}</p>
        <button type="button" className={button} onClick={reload}>{tr("جربي تاني", "Try again")}</button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={add} noValidate className="grid gap-3 rounded-xl bg-white p-4 shadow md:grid-cols-4">
        {input("code", tr("الكود", "Code"))}
        {input("percent", tr("الخصم %", "Discount %"), "number")}
        {input("min", tr("أقل قيمة للمنتجات (اختياري)", "Minimum products total (optional)"), "number")}
        {input("until", tr("آخر يوم (اختياري)", "Last day (optional)"), "date")}
        <button type="submit" disabled={busy} className="btn bg-navy text-linen disabled:opacity-60 md:col-span-4 md:justify-self-start">{tr("إضافة كوبون", "Add coupon")}</button>
        <p className="text-sm md:col-span-4">{tr("الخصم على المنتجات بس، مش على الشحن. وآخر يوم بيتحسب بتوقيت القاهرة.", "The discount is on products only, not shipping. The last day counts in Cairo time.")}</p>
      </form>

      <p role="status" className="mt-4 min-h-6 font-bold">{message}</p>
      {!coupons ? (
        <p role="status" className="opacity-70">{tr("بنحمّل...", "Loading...")}</p>
      ) : !coupons.length ? (
        <p>{tr("مفيش كوبونات لسه.", "No coupons yet.")}</p>
      ) : (
        <ul className="space-y-3">
          {coupons.map((c) => (
            <li key={c.id} className={`flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow ${c.active ? "" : "opacity-60"}`}>
              <p className="min-w-0 flex-1">
                <bdi className="font-bold">{c.code}</bdi> · {tr("خصم", "Discount")} {num(c.percent)}%
                {c.minTotal > 0 && ` · ${tr("للطلبات من", "Orders from EGP")} ${num(c.minTotal)}`}
                {c.validUntil && <> · {tr("لحد", "Until")} <bdi>{c.validUntil}</bdi></>}
                {!c.active && ` · ${tr("متوقف", "Paused")}`}
              </p>
              <button type="button" className={button} onClick={() => toggle(c)}>
                {c.active ? tr("إيقاف", "Pause") : tr("تشغيل", "Resume")}
              </button>
              <button type="button" className={button} onClick={() => remove(c)}>{tr("مسح", "Delete")}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
