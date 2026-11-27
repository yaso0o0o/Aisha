"use client";

import { useState, type FormEvent } from "react";
import { zoneStore, type Zone } from "@/data/admin";
import { field } from "./ProductForm";
import { useAdmin } from "./lang";

export default function Shipping() {
  const zones = zoneStore.useList();
  const { lang, tr } = useAdmin();
  const nameOf = (z: Zone) => (lang === "ar" ? z.nameAr : z.nameEn || z.nameAr);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  const change = (id: string, patch: Partial<Zone>) =>
    zoneStore.write(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));

  function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || price === "" || Number(price) < 0) return setError(tr("اكتبي اسم المنطقة وسعر الشحن.", "Enter the area name and shipping price."));
    zoneStore.write([...zones, { id: `z-${Date.now().toString(36)}`, nameAr: name.trim(), nameEn: "", price: Number(price) }]);
    setName("");
    setPrice("");
    setError("");
  }

  return (
    <>
      <ul className="space-y-3">
        {zones.map((z) => (
          <li key={z.id} className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow">
            <p className="min-w-0 flex-1 self-center font-bold">{nameOf(z)}</p>
            <label className="text-sm font-bold">
              {tr("سعر الشحن", "Shipping price")}
              <input
                key={z.price}
                type="number"
                min="0"
                className={`${field} !w-28`}
                defaultValue={z.price}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (e.target.value !== "" && value >= 0 && value !== z.price) change(z.id, { price: value });
                  else e.target.value = String(z.price);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
            <button type="button" className="min-h-11 rounded-lg border border-navy/25 px-4 font-bold" onClick={() => confirm(`${tr("تمسحي منطقة", "Delete area")} ${nameOf(z)}?`) && zoneStore.write(zones.filter((x) => x.id !== z.id))}>{tr("مسح", "Delete")}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} noValidate className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow">
        <label className="min-w-0 flex-1 text-sm font-bold">
          {tr("منطقة جديدة", "New area")}
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm font-bold">
          {tr("السعر", "Price")}
          <input className={`${field} !w-28`} type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <button type="submit" className="btn bg-navy text-linen">{tr("إضافة", "Add")}</button>
        <p role="alert" className="basis-full font-bold text-wine">{error}</p>
      </form>
    </>
  );
}
