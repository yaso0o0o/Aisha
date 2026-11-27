"use client";

import { useState } from "react";
import { removeProduct, saveProduct, totalStock, useAdminProducts, type AdminProduct } from "@/data/admin";
import { categories, formatPrice } from "@/data/products";
import { search } from "@/data/search";
import ProductForm, { field } from "./ProductForm";
import { useAdmin } from "./lang";

const action = "min-h-11 rounded-lg border border-navy/25 px-4 font-bold hover:bg-navy/5";

export default function Dashboard() {
  const products = useAdminProducts();
  const { lang, tr, num } = useAdmin();
  const nameOf = (p: AdminProduct) => (lang === "ar" ? p.nameAr : p.nameEn || p.nameAr);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  // undefined: list, null: new product
  const [editing, setEditing] = useState<AdminProduct | null | undefined>(undefined);
  const [deleting, setDeleting] = useState("");
  const [message, setMessage] = useState("");

  if (editing !== undefined) {
    return (
      <ProductForm
        initial={editing}
        onClose={(saved) => {
          setEditing(undefined);
          setMessage(saved ? tr("المنتج اتحفظ.", "Product saved.") : "");
        }}
      />
    );
  }

  const shown = search(
    products.filter((p) => !category || p.category === category),
    query,
    (p) => `${p.nameAr} ${p.nameEn} ${categories.find((c) => c.id === p.category)?.name[lang]}`,
  );

  const stats = [
    [tr("كل المنتجات", "All products"), products.length],
    [tr("خلصت من المخزون", "Out of stock"), products.filter((p) => !p.madeToOrder && totalStock(p) === 0).length],
    [tr("عليها خصم", "On discount"), products.filter((p) => p.discount > 0).length],
    [tr("مخفية", "Hidden"), products.filter((p) => p.hidden).length],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([name, value]) => (
          <li key={name} className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm">{name}</p>
            <p className="font-display text-3xl font-bold">{num(Number(value))}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <input type="search" aria-label={tr("بحث", "Search")} placeholder={tr("دوري على منتج...", "Search for a product...")} className={`${field} !mt-0 min-w-0 flex-1 basis-full md:basis-0`} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label={tr("القسم", "Category")} className={`${field} !mt-0 !w-auto`} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{tr("كل الأقسام", "All categories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name[lang]}</option>
          ))}
        </select>
        <button type="button" className="btn bg-navy text-linen" onClick={() => setEditing(null)}>{tr("إضافة منتج", "Add product")}</button>
      </div>

      <p role="status" className="mt-4 min-h-6 font-bold">{message}</p>

      <ul className="space-y-3">
        {shown.map((p) => (
          <li key={p.slug} className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-3 shadow">
            {/* eslint-disable-next-line @next/next/no-img-element -- may be a local data URL */}
            <img src={p.image} alt="" loading="lazy" className="h-20 w-16 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 basis-48">
              <h2 className="font-bold">{nameOf(p)}</h2>
              <p className="text-sm">
                {categories.find((c) => c.id === p.category)?.name[lang]}
                {" · "}
                {p.madeToOrder ? tr("بالطلب", "Made to order") : `${tr("المخزون", "Stock")}: ${num(totalStock(p))}`}
                {p.discount > 0 && ` · ${tr("خصم", "Discount")} ${num(p.discount)}%`}
                {p.hidden && ` · ${tr("مخفي", "Hidden")}`}
              </p>
            </div>
            <label className="text-sm font-bold">
              {tr("السعر", "Price")}
              <input
                key={p.price}
                type="number"
                min="1"
                className={`${field} !w-28`}
                defaultValue={p.price}
                onBlur={(e) => {
                  const price = Number(e.target.value);
                  if (price > 0 && price !== p.price) {
                    saveProduct({ ...p, price });
                    setMessage(`${nameOf(p)}: ${formatPrice(price, lang)}`);
                  } else e.target.value = String(p.price);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
            {deleting === p.slug ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{tr("متأكدة؟", "Sure?")}</span>
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-wine px-4 font-bold text-linen"
                  onClick={() => {
                    removeProduct(p.slug);
                    setDeleting("");
                    setMessage(`${nameOf(p)}: ${tr("اتمسح", "deleted")}`);
                  }}
                >
                  {tr("امسحي", "Delete")}
                </button>
                <button type="button" className={action} onClick={() => setDeleting("")}>{tr("لأ", "No")}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" className={action} onClick={() => setEditing(p)}>{tr("تعديل", "Edit")}</button>
                <button type="button" className={action} onClick={() => setDeleting(p.slug)}>{tr("مسح", "Delete")}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!shown.length && <p className="mt-6">{tr("مفيش منتجات بالبحث ده.", "No products match.")}</p>}
    </div>
  );
}
