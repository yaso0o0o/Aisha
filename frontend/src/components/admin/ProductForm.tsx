"use client";

import { useState, type FormEvent } from "react";
import { saveProduct, variants, type AdminProduct } from "@/data/admin";
import { useAdmin } from "./lang";
import { readPhoto } from "@/data/photo";
import { categories, type CategoryId } from "@/data/products";

export const field = "mt-1 min-h-11 w-full rounded-lg border border-navy/25 bg-white px-3 text-base text-navy";
const label = "block text-sm font-bold";

const list = (text: string) => [...new Set(text.split(/[,،]/).map((x) => x.trim()).filter(Boolean))];

export default function ProductForm({ initial, onClose }: { initial: AdminProduct | null; onClose: (saved: boolean) => void }) {
  const [p, setP] = useState<AdminProduct>(
    () =>
      initial ?? {
        slug: `p-${Date.now().toString(36)}`,
        nameAr: "",
        nameEn: "",
        category: categories[0].id,
        image: "",
        price: 0,
        discount: 0,
        colors: [],
        sizes: [],
        madeToOrder: false,
        days: 14,
        stock: {},
        hidden: false,
      },
  );
  const [colors, setColors] = useState(p.colors.join("، "));
  const [sizes, setSizes] = useState(p.sizes.join(", "));
  const [error, setError] = useState("");
  const { lang, tr } = useAdmin();
  const set = (patch: Partial<AdminProduct>) => setP((old) => ({ ...old, ...patch }));
  const options = { colors: list(colors), sizes: list(sizes) };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!p.nameAr.trim()) return setError(tr("اكتبي اسم المنتج بالعربي.", "Enter the Arabic product name."));
    if (!p.image) return setError(tr("اختاري صورة للمنتج.", "Choose a product photo."));
    if (!(p.price > 0)) return setError(tr("السعر لازم يكون أكبر من صفر.", "The price must be above zero."));
    const next = { ...p, ...options, nameAr: p.nameAr.trim(), nameEn: p.nameEn.trim() };
    next.stock = Object.fromEntries(variants(next).map((v) => [v.key, p.stock[v.key] ?? 0]));
    try {
      saveProduct(next);
    } catch {
      return setError(tr("المتصفح مش قادر يحفظ، غالبًا المساحة التجريبية اتملت. امسحي منتج بصورة مرفوعة وجربي تاني.", "The browser could not save, most likely the demo storage is full. Delete a product with an uploaded photo and try again."));
    }
    onClose(true);
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-5 shadow-lg md:p-8">
      <h2 className="font-display text-3xl font-bold">{initial ? tr("تعديل المنتج", "Edit product") : tr("منتج جديد", "New product")}</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          {tr("الاسم بالعربي", "Arabic name")}
          <input className={field} value={p.nameAr} onChange={(e) => set({ nameAr: e.target.value })} />
        </label>
        <label className={label}>
          {tr("الاسم بالإنجليزي", "English name")}
          <input className={field} dir="ltr" value={p.nameEn} onChange={(e) => set({ nameEn: e.target.value })} />
        </label>
        <label className={label}>
          {tr("القسم", "Category")}
          <select className={field} value={p.category} onChange={(e) => set({ category: e.target.value as CategoryId })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name[lang]}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {tr("صورة المنتج", "Product photo")}
          <input
            type="file"
            accept="image/*"
            className={`${field} py-2`}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                set({ image: await readPhoto(file) });
                setError("");
              } catch {
                setError(tr("الملف ده مش صورة المتصفح يقدر يقراها. جربي JPG أو PNG.", "This file is not a readable image. Try JPG or PNG."));
              }
            }}
          />
        </label>
      </div>

      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element -- may be a local data URL
        <img src={p.image} alt="" className="h-40 rounded-lg object-cover" />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          {tr("السعر (جنيه)", "Price (EGP)")}
          <input className={field} type="number" min="0" inputMode="numeric" value={p.price || ""} onChange={(e) => set({ price: Number(e.target.value) })} />
        </label>
        <label className={label}>
          {tr("خصم (%)", "Discount (%)")}
          <input className={field} type="number" min="0" max="90" inputMode="numeric" value={p.discount || ""} onChange={(e) => set({ discount: Math.min(90, Math.max(0, Number(e.target.value))) })} />
          {p.discount > 0 && p.price > 0 && (
            <span className="mt-1 block font-normal">{tr("السعر بعد الخصم", "Price after discount")}: {Math.round(p.price * (1 - p.discount / 100))}</span>
          )}
        </label>
        <label className={label}>
          {tr("الألوان (سيبيها فاضية لو مفيش)", "Colours (leave empty if none)")}
          <input className={field} value={colors} placeholder={tr("أحمر، أسود", "أحمر، أسود")} onChange={(e) => setColors(e.target.value)} />
        </label>
        <label className={label}>
          {tr("المقاسات (سيبيها فاضية لو مفيش)", "Sizes (leave empty if none)")}
          <input className={field} dir="ltr" value={sizes} placeholder="S, M, L" onChange={(e) => setSizes(e.target.value)} />
        </label>
      </div>

      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input type="checkbox" className="h-5 w-5" checked={p.madeToOrder} onChange={(e) => set({ madeToOrder: e.target.checked })} />
        {tr("بتتعمل بالطلب", "Made to order")}
      </label>

      {p.madeToOrder ? (
        <label className={label}>
          {tr("مدة التنفيذ (يوم)", "Lead time (days)")}
          <input className={field} type="number" min="1" value={p.days} onChange={(e) => set({ days: Math.max(1, Number(e.target.value)) })} />
        </label>
      ) : (
        <fieldset>
          <legend className="text-sm font-bold">{tr("المخزون", "Stock")}</legend>
          <div className="mt-1 grid grid-cols-2 gap-3 md:grid-cols-4">
            {variants(options).map((v) => (
              <label key={v.key} className="text-sm">
                {v.label === "القطعة" ? tr("القطعة", "Item") : v.label}
                <input className={field} type="number" min="0" inputMode="numeric" value={p.stock[v.key] ?? 0} onChange={(e) => set({ stock: { ...p.stock, [v.key]: Math.max(0, Math.floor(Number(e.target.value))) } })} />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input type="checkbox" className="h-5 w-5" checked={p.hidden} onChange={(e) => set({ hidden: e.target.checked })} />
        {tr("إخفاء من المتجر", "Hide from the shop")}
      </label>

      <p role="alert" className="min-h-6 font-bold text-wine">{error}</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn bg-navy text-linen">{tr("حفظ المنتج", "Save product")}</button>
        <button type="button" className="btn" onClick={() => onClose(false)}>{tr("إلغاء", "Cancel")}</button>
      </div>
    </form>
  );
}
