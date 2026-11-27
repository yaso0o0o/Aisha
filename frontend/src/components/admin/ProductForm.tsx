"use client";

import { useState, type FormEvent } from "react";
import { ApiError, createProduct, updateProduct, uploadImage, type ApiProduct, type ProductInput } from "@/data/api";
import { categories } from "@/data/products";
import { useAdmin } from "./lang";

export const field = "mt-1 min-h-11 w-full rounded-lg border border-navy/25 bg-white px-3 text-base text-navy";
const label = "block text-sm font-bold";

const list = (text: string) => [...new Set(text.split(/[,،]/).map((x) => x.trim()).filter(Boolean))];
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const stockKey = (colorEn: string, size: string) => `${colorEn.toLowerCase()}|${size.toLowerCase()}`;

export default function ProductForm({ initial, onClose }: { initial: ApiProduct | null; onClose: (saved: ApiProduct | null) => void }) {
  const { lang, tr } = useAdmin();
  const [p, setP] = useState(() => ({
    nameAr: initial?.nameAr ?? "",
    nameEn: initial?.nameEn ?? "",
    category: initial?.category ?? categories[0].id,
    images: initial?.images ?? [],
    price: initial?.price ?? 0,
    discount: initial?.discount ?? 0,
    madeToOrder: initial?.madeToOrder ?? false,
    leadDays: initial?.leadDays ?? 14,
    hidden: initial?.hidden ?? false,
  }));
  const [colorsAr, setColorsAr] = useState(unique(initial?.variants.map((v) => v.colorAr) ?? []).join("، "));
  const [colorsEn, setColorsEn] = useState(unique(initial?.variants.map((v) => v.colorEn) ?? []).join(", "));
  const [sizes, setSizes] = useState(unique(initial?.variants.map((v) => v.size) ?? []).join(", "));
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial?.variants.map((v) => [stockKey(v.colorEn, v.size), v.stock]) ?? []),
  );
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof p>) => setP((old) => ({ ...old, ...patch }));

  const ar = list(colorsAr);
  const en = list(colorsEn);
  const colours = ar.length ? ar.map((a, i) => ({ colorAr: a, colorEn: en[i] ?? "" })) : [{ colorAr: "", colorEn: "" }];
  const sizeList = list(sizes).length ? list(sizes) : [""];
  const variants = colours.flatMap((c) =>
    sizeList.map((size) => ({
      ...c,
      size,
      stock: stock[stockKey(c.colorEn, size)] ?? 0,
      label: [lang === "ar" ? c.colorAr : c.colorEn || c.colorAr, size].filter(Boolean).join(" / ") || tr("القطعة", "Item"),
    })),
  );

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      set({ images: [...p.images, url] });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError(
        status === 413
          ? tr("الصورة كبيرة أوي. الحد 8 ميجا.", "The photo is too big. The limit is 8 MB.")
          : status === 422
            ? tr("الملف ده مش صورة. جربي JPG أو PNG.", "This file is not an image. Try JPG or PNG.")
            : tr("الصورة متعرفعتش. جربي تاني.", "The photo was not uploaded. Try again."),
      );
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || uploading) return;
    if (!p.nameAr.trim()) return setError(tr("اكتبي اسم المنتج بالعربي.", "Enter the Arabic product name."));
    if (!p.images.length) return setError(tr("ارفعي صورة للمنتج.", "Upload a product photo."));
    if (!(p.price > 0)) return setError(tr("السعر لازم يكون أكبر من صفر.", "The price must be above zero."));
    if (ar.length !== en.length) {
      return setError(tr("عدد الألوان بالعربي لازم يساوي عددها بالإنجليزي وبنفس الترتيب.", "Give every colour in Arabic and English, in the same order."));
    }
    const input: ProductInput = {
      ...p,
      nameAr: p.nameAr.trim(),
      nameEn: p.nameEn.trim(),
      leadDays: p.madeToOrder ? p.leadDays : null,
      variants: variants.map(({ colorAr, colorEn, size, stock }) => ({ colorAr, colorEn, size, stock })),
    };
    setSaving(true);
    setError("");
    try {
      onClose(initial ? await updateProduct(initial.id, { ...input, updatedAt: initial.updatedAt }) : await createProduct(input));
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setError(
        err?.status === 409 && err.body.error === "changed"
          ? tr("المنتج ده اتعدل من مكان تاني بعد ما فتحتيه. ارجعي للقايمة وافتحيه تاني.", "This product was changed elsewhere after you opened it. Go back to the list and open it again.")
          : err?.body.error === "duplicate_variant"
            ? tr("فيه لون أو مقاس متكرر.", "A colour or size is repeated.")
            : err?.status === 422
              ? `${tr("فيه خانة مش مظبوطة", "A field is not valid")}: ${err.body.field ?? ""}`
              : tr("المنتج متحفظش. جربي تاني.", "The product was not saved. Try again."),
      );
      setSaving(false);
    }
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
          <select className={field} value={p.category} onChange={(e) => set({ category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name[lang]}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {tr("إضافة صورة", "Add a photo")}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            className={`${field} py-2`}
            onChange={(e) => {
              addPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {uploading && <span className="mt-1 block font-normal">{tr("بنرفع الصورة...", "Uploading...")}</span>}
        </label>
      </div>

      {p.images.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {p.images.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- photos come from the API */}
              <img src={url} alt="" className="h-32 w-24 rounded-lg object-cover" />
              {i === 0 && <span className="absolute start-1 top-1 rounded bg-navy px-2 text-xs text-linen">{tr("الأساسية", "Main")}</span>}
              <button type="button" className="mt-1 block w-full text-sm underline" onClick={() => set({ images: p.images.filter((x) => x !== url) })}>
                {tr("شيليها", "Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          {tr("السعر (جنيه)", "Price (EGP)")}
          <input className={field} type="number" min="0" inputMode="numeric" value={p.price || ""} onChange={(e) => set({ price: Math.floor(Number(e.target.value)) })} />
        </label>
        <label className={label}>
          {tr("خصم (%)", "Discount (%)")}
          <input className={field} type="number" min="0" max="90" inputMode="numeric" value={p.discount || ""} onChange={(e) => set({ discount: Math.min(90, Math.max(0, Math.floor(Number(e.target.value)))) })} />
          {p.discount > 0 && p.price > 0 && (
            <span className="mt-1 block font-normal">{tr("السعر بعد الخصم", "Price after discount")}: {Math.round(p.price * (1 - p.discount / 100))}</span>
          )}
        </label>
        <label className={label}>
          {tr("الألوان بالعربي (سيبيها فاضية لو مفيش)", "Colours in Arabic (leave empty if none)")}
          <input className={field} value={colorsAr} placeholder="أحمر، أسود" onChange={(e) => setColorsAr(e.target.value)} />
        </label>
        <label className={label}>
          {tr("نفس الألوان بالإنجليزي وبنفس الترتيب", "The same colours in English, same order")}
          <input className={field} dir="ltr" value={colorsEn} placeholder="Red, Black" onChange={(e) => setColorsEn(e.target.value)} />
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
          <input className={field} type="number" min="1" value={p.leadDays} onChange={(e) => set({ leadDays: Math.max(1, Math.floor(Number(e.target.value))) })} />
        </label>
      ) : (
        <fieldset>
          <legend className="text-sm font-bold">{tr("المخزون", "Stock")}</legend>
          <div className="mt-1 grid grid-cols-2 gap-3 md:grid-cols-4">
            {variants.map((v) => (
              <label key={stockKey(v.colorEn || v.colorAr, v.size)} className="text-sm">
                {v.label}
                <input
                  className={field}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={v.stock}
                  onChange={(e) => setStock({ ...stock, [stockKey(v.colorEn, v.size)]: Math.max(0, Math.floor(Number(e.target.value))) })}
                />
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
        <button type="submit" disabled={saving || uploading} className="btn bg-navy text-linen disabled:opacity-60">
          {saving ? tr("بنحفظ...", "Saving...") : tr("حفظ المنتج", "Save product")}
        </button>
        <button type="button" className="btn" onClick={() => onClose(null)}>{tr("إلغاء", "Cancel")}</button>
      </div>
    </form>
  );
}
