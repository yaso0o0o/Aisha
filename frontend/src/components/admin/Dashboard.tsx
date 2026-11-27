"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, deleteProduct, listProducts, totalStock, updateProduct, type ApiProduct } from "@/data/api";
import { categories, formatPrice } from "@/data/products";
import { search } from "@/data/search";
import ProductForm, { field } from "./ProductForm";
import { useAdmin } from "./lang";

const action = "min-h-11 rounded-lg border border-navy/25 px-4 font-bold hover:bg-navy/5";

export default function Dashboard() {
  const { lang, tr, num } = useAdmin();
  const [products, setProducts] = useState<ApiProduct[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const nameOf = (p: ApiProduct) => (lang === "ar" ? p.nameAr : p.nameEn || p.nameAr);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  // undefined: list, null: new product
  const [editing, setEditing] = useState<ApiProduct | null | undefined>(undefined);
  const [deleting, setDeleting] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setProducts(await listProducts());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load from the API
    load();
  }, [load]);

  const replace = (saved: ApiProduct) =>
    setProducts((list) => list && list.map((p) => (p.id === saved.id ? saved : p)));

  if (editing !== undefined) {
    return (
      <ProductForm
        initial={editing}
        onClose={(saved) => {
          setEditing(undefined);
          if (saved) {
            setProducts((list) => list && (list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...list]));
            setMessage(tr("المنتج اتحفظ.", "Product saved."));
          } else setMessage("");
        }}
      />
    );
  }

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        <p role="alert" className="font-bold">{tr("مقدرناش نجيب المنتجات من السيرفر.", "Could not load products from the server.")}</p>
        <button type="button" className={action} onClick={load}>{tr("جربي تاني", "Try again")}</button>
      </div>
    );
  }

  if (!products) return <p role="status" className="mx-auto max-w-5xl opacity-70">{tr("بنحمّل المنتجات...", "Loading products...")}</p>;

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

  async function savePrice(p: ApiProduct, input: HTMLInputElement) {
    const price = Number(input.value);
    if (!(price > 0) || price === p.price) {
      input.value = String(p.price);
      return;
    }
    try {
      replace(await updateProduct(p.id, { price, updatedAt: p.updatedAt }));
      setMessage(`${nameOf(p)}: ${formatPrice(price, lang)}`);
    } catch (error) {
      input.value = String(p.price);
      setMessage(
        error instanceof ApiError && error.status === 409
          ? tr("المنتج ده اتعدل من مكان تاني. حدّثنا القايمة، جربي تاني.", "This product was changed elsewhere. The list was refreshed, try again.")
          : tr("السعر متحفظش. جربي تاني.", "The price was not saved. Try again."),
      );
      if (error instanceof ApiError && error.status === 409) load();
    }
  }

  async function remove(p: ApiProduct) {
    setDeleting("");
    try {
      const { archived } = await deleteProduct(p.id);
      setProducts((list) => list && list.filter((x) => x.id !== p.id));
      setMessage(
        archived
          ? `${nameOf(p)}: ${tr("اتشال من المتجر، واتحفظ في الأرشيف علشان عليه طلبات قديمة.", "removed from the shop and archived because it has past orders.")}`
          : `${nameOf(p)}: ${tr("اتمسح", "deleted")}`,
      );
    } catch {
      setMessage(tr("المنتج متمسحش. جربي تاني.", "The product was not deleted. Try again."));
    }
  }

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
          <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-xl bg-white p-3 shadow">
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- photos come from the API
              <img src={p.images[0]} alt="" loading="lazy" className="h-20 w-16 rounded-lg object-cover" />
            ) : (
              <div className="h-20 w-16 rounded-lg bg-navy/10" />
            )}
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
                key={`${p.id}-${p.price}`}
                type="number"
                min="1"
                className={`${field} !w-28`}
                defaultValue={p.price}
                onBlur={(e) => savePrice(p, e.currentTarget)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </label>
            {deleting === p.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">{tr("متأكدة؟", "Sure?")}</span>
                <button type="button" className="min-h-11 rounded-lg bg-wine px-4 font-bold text-linen" onClick={() => remove(p)}>
                  {tr("امسحي", "Delete")}
                </button>
                <button type="button" className={action} onClick={() => setDeleting("")}>{tr("لأ", "No")}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" className={action} onClick={() => setEditing(p)}>{tr("تعديل", "Edit")}</button>
                <button type="button" className={action} onClick={() => setDeleting(p.id)}>{tr("مسح", "Delete")}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!shown.length && <p className="mt-6">{tr("مفيش منتجات بالبحث ده.", "No products match.")}</p>}
    </div>
  );
}
