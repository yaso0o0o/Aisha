"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { categories, formatPrice } from "@/data/products";
import { search } from "@/data/search";
import type { ShopProduct } from "@/data/shop-types";

type Labels = { label: string; placeholder: string; all: string; none: string; results: string; out: string };

/** Search and category filter over the products the server sent. */
export default function ProductSearch({ lang, t, products }: { lang: "ar" | "en"; t: Labels; products: ShopProduct[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const inCategory = products.filter((p) => !category || p.category === category);
  const found = search(inCategory, query, (p) => {
    const c = categories.find((x) => x.id === p.category);
    return [p.name.ar, p.name.en, c?.name.ar, c?.name.en, ...p.colors.flatMap((x) => [x.ar, x.en])].join(" ");
  });

  return (
    <>
      <div id="search" role="search" className="mt-6 scroll-mt-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.label}
          placeholder={t.placeholder}
          className="min-h-12 w-full max-w-xl rounded-full border border-gold bg-navy-deep px-6 text-base placeholder:text-linen/60"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {[{ id: null, name: t.all }, ...categories.map((c) => ({ id: c.id as string, name: c.name[lang] }))].map((c) => (
          <button
            key={c.id ?? "all"}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
            className="btn btn-line aria-pressed:bg-gold aria-pressed:text-navy"
          >
            {c.name}
          </button>
        ))}
      </div>

      <p role="status" className="mt-6 opacity-80">
        {found.length ? `${t.results}: ${found.length.toLocaleString(lang === "ar" ? "ar-EG" : "en")}` : t.none}
      </p>

      {categories.map((c) => {
        const items = found.filter((p) => p.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} id={c.id} className="scroll-mt-6 pt-10">
            <h2 className="font-display text-3xl text-gold">{c.name[lang]}</h2>
            <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-8">
              {items.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${lang}/products/${p.slug}`} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-2xl border border-gold/50">
                      {p.image && (
                        <Image src={p.image} alt={p.name[lang]} fill sizes="(min-width: 768px) 360px, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      )}
                      {p.soldOut && (
                        <span className="absolute inset-0 grid place-items-center bg-navy/65 text-lg font-bold">{t.out}</span>
                      )}
                    </div>
                    <h3 className="mt-3 text-center font-semibold">{p.name[lang] || p.name.ar}</h3>
                    <p className="text-center text-gold">
                      {formatPrice(p.finalPrice, lang)}
                      {p.discount > 0 && <s className="ms-2 text-sm text-linen/60">{formatPrice(p.price, lang)}</s>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
