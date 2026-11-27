"use client";

import { useState, type FormEvent } from "react";
import { createZone, deleteZone, listZones, updateZone, type AdminZone } from "@/data/api";
import { field } from "./ProductForm";
import { useAdmin } from "./lang";
import { useServerList } from "./useServerList";

const button = "min-h-11 rounded-lg border border-navy/25 px-4 font-bold";

export default function Shipping() {
  const { items: zones, setItems, failed, reload } = useServerList(listZones);
  const { lang, tr } = useAdmin();
  const nameOf = (z: AdminZone) => (lang === "ar" ? z.nameAr : z.nameEn || z.nameAr);
  const [form, setForm] = useState({ nameAr: "", nameEn: "", price: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function change(z: AdminZone, patch: Partial<AdminZone>) {
    try {
      const saved = await updateZone(z.id, patch);
      setItems((list) => list && list.map((x) => (x.id === z.id ? saved : x)));
      setMessage(`${nameOf(saved)}: ${tr("اتحفظ", "saved")}`);
    } catch {
      setMessage(tr("التعديل متحفظش. جربي تاني.", "The change was not saved. Try again."));
      reload();
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const price = Number(form.price);
    if (!form.nameAr.trim() || form.price === "" || !(price >= 0)) {
      return setMessage(tr("اكتبي اسم المنطقة بالعربي وسعر الشحن.", "Enter the Arabic area name and the shipping price."));
    }
    setBusy(true);
    try {
      const saved = await createZone({ nameAr: form.nameAr.trim(), nameEn: form.nameEn.trim(), price: Math.floor(price) });
      setItems((list) => list && [...list, saved]);
      setForm({ nameAr: "", nameEn: "", price: "" });
      setMessage(`${nameOf(saved)}: ${tr("اتضافت", "added")}`);
    } catch {
      setMessage(tr("المنطقة متضافتش. جربي تاني.", "The area was not added. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(z: AdminZone) {
    if (!confirm(`${tr("تمسحي منطقة", "Delete area")} ${nameOf(z)}?`)) return;
    try {
      await deleteZone(z.id);
      setItems((list) => list && list.filter((x) => x.id !== z.id));
      setMessage(`${nameOf(z)}: ${tr("اتمسحت", "deleted")}`);
    } catch {
      setMessage(tr("المنطقة متمسحتش. جربي تاني.", "The area was not deleted. Try again."));
    }
  }

  if (failed) {
    return (
      <div className="space-y-3">
        <p role="alert" className="font-bold">{tr("مقدرناش نجيب مناطق الشحن من السيرفر.", "Could not load shipping areas from the server.")}</p>
        <button type="button" className={button} onClick={reload}>{tr("جربي تاني", "Try again")}</button>
      </div>
    );
  }
  if (!zones) return <p role="status" className="opacity-70">{tr("بنحمّل...", "Loading...")}</p>;

  return (
    <>
      <p role="status" className="mb-3 min-h-6 font-bold">{message}</p>
      {!zones.length && <p>{tr("مفيش مناطق شحن. العميلة مش هتقدر تطلب لحد ما تضيفي منطقة.", "No shipping areas. Customers cannot order until you add one.")}</p>}
      <ul className="space-y-3">
        {zones.map((z) => (
          <li key={z.id} className={`flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow ${z.active ? "" : "opacity-60"}`}>
            <p className="min-w-0 flex-1 self-center font-bold">
              {nameOf(z)}
              {!z.active && <span className="font-normal"> · {tr("متوقفة", "Paused")}</span>}
            </p>
            <label className="text-sm font-bold">
              {tr("سعر الشحن", "Shipping price")}
              <input
                key={`${z.id}-${z.price}`}
                type="number"
                min="0"
                className={`${field} !w-28`}
                defaultValue={z.price}
                onBlur={(e) => {
                  const value = Math.floor(Number(e.target.value));
                  if (e.target.value !== "" && value >= 0 && value !== z.price) change(z, { price: value });
                  else e.target.value = String(z.price);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
            <button type="button" className={button} onClick={() => change(z, { active: !z.active })}>
              {z.active ? tr("إيقاف", "Pause") : tr("تشغيل", "Resume")}
            </button>
            <button type="button" className={button} onClick={() => remove(z)}>{tr("مسح", "Delete")}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate className="mt-4 grid gap-3 rounded-xl bg-white p-4 shadow md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <label className="text-sm font-bold">
          {tr("منطقة جديدة بالعربي", "New area in Arabic")}
          <input className={field} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
        </label>
        <label className="text-sm font-bold">
          {tr("الاسم بالإنجليزي", "English name")}
          <input className={field} dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </label>
        <label className="text-sm font-bold">
          {tr("السعر", "Price")}
          <input className={`${field} !w-28`} type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </label>
        <button type="submit" disabled={busy} className="btn bg-navy text-linen disabled:opacity-60">{tr("إضافة", "Add")}</button>
      </form>
    </>
  );
}
