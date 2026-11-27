"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart, useCart } from "@/data/cart";
import { formatPrice } from "@/data/products";
import { availableOf, type ShopProductDetail, type Text } from "@/data/shop-types";

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

/** Price, options and stock as the server sent them. */
export default function ProductBuy({ product, lang, t }: { product: ShopProductDetail; lang: "ar" | "en"; t: Labels }) {
  const cart = useCart();
  const [color, setColor] = useState(0);
  const [size, setSize] = useState(0);
  const [done, setDone] = useState(false);

  const colors = [...new Map(product.variants.flatMap((v) => (v.color ? [[v.color.en, v.color] as const] : []))).values()];
  const sizes = [...new Set(product.variants.flatMap((v) => (v.size ? [v.size] : [])))];
  const variantFor = (c: Text | undefined, s: string | undefined) =>
    product.variants.find((v) => (v.color?.en ?? undefined) === c?.en && (v.size ?? undefined) === s);

  const c = colors[color] ? color : 0;
  const s = sizes[size] ? size : 0;
  const variant = variantFor(colors[c], sizes[s]);
  const stock = availableOf(product, variant);
  const inCart = cart.find((l) => l.variantId === variant?.id)?.qty ?? 0;
  const soldOut = !product.madeToOrder && product.variants.every((v) => !v.stock);

  const groups = [
    { name: "color", label: t.color, values: colors.map((x) => x[lang] || x.ar), picked: c, pick: setColor,
      gone: (i: number) => !availableOf(product, variantFor(colors[i], sizes[s])) },
    { name: "size", label: t.size, values: sizes, picked: s, pick: setSize,
      gone: (i: number) => !availableOf(product, variantFor(colors[c], sizes[i])) },
  ].filter((g) => g.values.length);

  return (
    <>
      <p className="mt-4 text-3xl font-bold text-gold">
        {formatPrice(product.finalPrice, lang)}
        {product.discount > 0 && (
          <s className="ms-3 text-lg font-normal text-linen/60">{formatPrice(product.price, lang)}</s>
        )}
      </p>
      {product.madeToOrder && <p className="mt-2 opacity-85">{t.madeToOrder.replace("{days}", String(product.leadDays ?? 14))}</p>}

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

        {soldOut || !stock || !variant ? (
          <p className="inline-block rounded-full bg-wine px-6 py-3 font-bold">{t.out}</p>
        ) : (
          <>
            {!product.madeToOrder && stock <= 2 && <p className="font-bold text-gold">{t.left.replace("{n}", String(stock))}</p>}
            <button
              type="button"
              className="btn btn-solid w-full disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              disabled={inCart >= stock}
              onClick={() => {
                addToCart({ slug: product.slug, variantId: variant.id, qty: 1 });
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
