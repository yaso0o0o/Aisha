"use client";

import Link from "next/link";
import { useState } from "react";
import { available, finalPrice, soldOut, useAdminProducts, variantKey } from "@/data/admin";
import { addToCart, useCart } from "@/data/cart";
import { formatPrice, products } from "@/data/products";

type Labels = {
  color: string;
  size: string;
  add: string;
  added: string;
  view: string;
  madeToOrder: string;
  out: string;
  left: string;
  allInCart: string;
};

const choice =
  "btn btn-line cursor-pointer has-checked:bg-gold has-checked:text-navy has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-gold";

/** Price, options and stock, following what the dashboard says. */
export default function ProductBuy({ slug, lang, t }: { slug: string; lang: "ar" | "en"; t: Labels }) {
  const product = useAdminProducts().find((p) => p.slug === slug);
  const cart = useCart();
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(0);
  const [done, setDone] = useState(false);

  if (!product || product.hidden) return <p className="mt-6 text-xl font-bold">{t.out}</p>;

  // colours are stored in Arabic; use the English name when we know it
  const english = products.find((p) => p.slug === slug)?.colors;
  const colorName = (name: string) => (lang === "en" ? (english?.find((c) => c.ar === name)?.en ?? name) : name);

  const c = product.colors[color] ? color : 0;
  const s = product.sizes[size] ? size : 0;
  const key = variantKey(product.colors[c], product.sizes[s]);
  const stock = available(product, key);
  const inCart = cart.find(
    (l) => l.slug === slug && (l.color ?? 0) === c && (l.size ?? 0) === s,
  )?.qty ?? 0;

  const groups = [
    { name: "color", label: t.color, values: product.colors.map(colorName), picked: c, pick: setColor,
      gone: (i: number) => !available(product, variantKey(product.colors[i], product.sizes[s])) },
    { name: "size", label: t.size, values: product.sizes, picked: s, pick: setSize,
      gone: (i: number) => !available(product, variantKey(product.colors[c], product.sizes[i])) },
  ].filter((g) => g.values.length);

  return (
    <>
      <p className="mt-4 text-3xl font-bold text-gold">
        {formatPrice(finalPrice(product), lang)}
        {product.discount > 0 && (
          <s className="ms-3 text-lg font-normal text-linen/60">{formatPrice(product.price, lang)}</s>
        )}
      </p>
      {product.madeToOrder && <p className="mt-2 opacity-85">{t.madeToOrder.replace("{days}", String(product.days))}</p>}

      <div className="mt-8 space-y-6">
        {groups.map((group) => (
          <fieldset key={group.name}>
            <legend className="mb-3 font-bold">{group.label}</legend>
            <div className="flex flex-wrap gap-3">
              {group.values.map((value, i) => (
                <label key={value} className={`${choice} ${group.gone(i) ? "line-through opacity-50" : ""}`}>
                  <input
                    type="radio"
                    className="sr-only"
                    name={group.name}
                    checked={group.picked === i}
                    onChange={() => {
                      group.pick(i);
                      setDone(false);
                    }}
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        {soldOut(product) || !stock ? (
          <p className="inline-block rounded-full bg-wine px-6 py-3 font-bold">{t.out}</p>
        ) : (
          <>
            {!product.madeToOrder && stock <= 2 && <p className="font-bold text-gold">{t.left.replace("{n}", String(stock))}</p>}
            <button
              type="button"
              className="btn btn-solid w-full disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              disabled={inCart >= stock}
              onClick={() => {
                addToCart({
                  slug,
                  qty: 1,
                  ...(product.colors.length ? { color: c } : {}),
                  ...(product.sizes.length ? { size: s } : {}),
                });
                setDone(true);
              }}
            >
              {t.add}
            </button>
          </>
        )}
        <p role="status" className="min-h-6">
          {stock > 0 && inCart >= stock ? t.allInCart : done ? t.added : ""}{" "}
          {(done || inCart > 0) && (
            <Link className="font-bold text-gold underline" href={`/${lang}/cart`}>{t.view}</Link>
          )}
        </p>
      </div>
    </>
  );
}
