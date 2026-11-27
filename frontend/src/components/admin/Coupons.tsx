"use client";

import { useState, type FormEvent } from "react";
import { couponStore } from "@/data/admin";
import { field } from "./ProductForm";
import { useAdmin } from "./lang";

const empty = { code: "", percent: "", min: "", until: "" };
const button = "min-h-11 rounded-lg border border-navy/25 px-4 font-bold";

export default function Coupons() {
  const coupons = couponStore.useList();
  const { tr, num } = useAdmin();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  function add(e: FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const percent = Number(form.percent);
    if (!code) return setError(tr("اكتبي كود الكوبون.", "Enter a coupon code."));
    if (!(percent >= 1 && percent <= 90)) return setError(tr("نسبة الخصم من 1 لـ 90.", "The discount must be between 1 and 90."));
    if (coupons.some((c) => c.code === code)) return setError(tr("الكود ده موجود بالفعل.", "This code already exists."));
    couponStore.write([{ code, percent, min: Number(form.min) || 0, until: form.until, active: true }, ...coupons]);
    setForm(empty);
    setError("");
  }

  const input = (key: keyof typeof empty, label: string, type = "text") => (
    <label className="text-sm font-bold">
      {label}
      <input className={field} type={type} min={type === "number" ? 0 : undefined} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );

  return (
    <>
      <form onSubmit={add} noValidate className="grid gap-3 rounded-xl bg-white p-4 shadow md:grid-cols-4">
        {input("code", tr("الكود", "Code"))}
        {input("percent", tr("الخصم %", "Discount %"), "number")}
        {input("min", tr("أقل قيمة للطلب (اختياري)", "Minimum order (optional)"), "number")}
        {input("until", tr("شغال لحد (اختياري)", "Valid until (optional)"), "date")}
        <button type="submit" className="btn bg-navy text-linen md:col-span-4 md:justify-self-start">{tr("إضافة كوبون", "Add coupon")}</button>
        <p role="alert" className="font-bold text-wine md:col-span-4">{error}</p>
      </form>

      {!coupons.length && <p className="mt-6">{tr("مفيش كوبونات لسه.", "No coupons yet.")}</p>}
      <ul className="mt-4 space-y-3">
        {coupons.map((c) => (
          <li key={c.code} className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow">
            <p className="min-w-0 flex-1">
              <bdi className="font-bold">{c.code}</bdi> · {tr("خصم", "Discount")} {num(c.percent)}%
              {c.min > 0 && ` · ${tr("للطلبات من", "Orders from EGP")} ${num(c.min)}`}
              {c.until && <> · {tr("لحد", "Until")} <bdi>{c.until}</bdi></>}
              {!c.active && ` · ${tr("متوقف", "Paused")}`}
            </p>
            <button type="button" className={button} onClick={() => couponStore.write(coupons.map((x) => (x.code === c.code ? { ...x, active: !x.active } : x)))}>
              {c.active ? tr("إيقاف", "Pause") : tr("تشغيل", "Resume")}
            </button>
            <button type="button" className={button} onClick={() => confirm(`${tr("تمسحي الكوبون", "Delete coupon")} ${c.code}?`) && couponStore.write(coupons.filter((x) => x.code !== c.code))}>{tr("مسح", "Delete")}</button>
          </li>
        ))}
      </ul>
    </>
  );
}
