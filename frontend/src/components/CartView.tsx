"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { available, finalPrice, useAdminProducts, variantKey, type Order } from "@/data/admin";
import { setQty, useCart } from "@/data/cart";
import { rememberOrder } from "@/data/mine";
import { formatPrice, products } from "@/data/products";
import Checkout, { type CheckoutLabels } from "./Checkout";
import OrderStatus, { type StatusLabels } from "./OrderStatus";

type Labels = {
  empty: string;
  browse: string;
  remove: string;
  increase: string;
  decrease: string;
  total: string;
  message: string;
  color: string;
  size: string;
};

const round = "grid h-11 w-11 place-items-center rounded-full border border-gold text-xl hover:bg-gold/20 disabled:opacity-40";

export default function CartView({ lang, t, checkout, status }: { lang: "ar" | "en"; t: Labels; checkout: CheckoutLabels; status: StatusLabels }) {
  const live = useAdminProducts();
  const cart = useCart();
  const [placed, setPlaced] = useState<Order | null>(null);

  const lines = cart.flatMap((line) => {
    const now = live.find((p) => p.slug === line.slug);
    if (!now) return [];
    const base = products.find((p) => p.slug === line.slug);
    const color = now.colors[line.color ?? 0];
    const size = now.sizes[line.size ?? 0];
    const key = variantKey(color, size);
    const name = lang === "ar" ? now.nameAr : now.nameEn || now.nameAr;
    const colorName = lang === "en" ? (base?.colors?.find((c) => c.ar === color)?.en ?? color) : color;
    const details = [color && `${t.color}: ${colorName}`, size && `${t.size}: ${size}`].filter(Boolean).join(" / ");
    return [{ line, now, key, name, details, max: available(now, key), price: finalPrice(now) }];
  });

  if (placed) {
    const message = [
      t.message,
      `#${placed.id}`,
      ...placed.lines.map((l) => `- ${l.name} (${l.label}) × ${l.qty}`),
      `${t.total}: ${formatPrice(placed.total, lang)}`,
    ].join("\n");
    return (
      <div role="status" className="mt-10">
        <p className="text-2xl font-bold">{checkout.done} <bdi className="text-gold">{placed.id}</bdi></p>
        <p className="mt-2 text-lg">{t.total}: {formatPrice(placed.total, lang)}</p>
        <OrderStatus id={placed.id} t={status} />
        <Link className="mt-4 block font-bold text-gold underline" href={`/${lang}/orders`}>{status.mine}</Link>
        <a className="btn btn-solid mt-6" href={`https://wa.me/201281227555?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          {checkout.send}
        </a>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="mt-10">
        <p className="text-lg opacity-85">{t.empty}</p>
        <Link className="btn btn-solid mt-6" href={`/${lang}/products`}>{t.browse}</Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.line.qty, 0);

  return (
    <>
      <ul className="mt-8 divide-y divide-gold/30">
        {lines.map(({ line, now, name, details, max, price }) => (
          <li key={`${line.slug}-${line.color}-${line.size}`} className="flex gap-4 py-5">
            <Link href={`/${lang}/products/${line.slug}`} className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-t-full rounded-b-lg border border-gold/50">
              <Image src={now.image} alt={name} fill sizes="96px" unoptimized={now.image.startsWith("data:")} className="object-cover" />
            </Link>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{name}</h2>
              {details && <p className="text-sm opacity-80">{details}</p>}
              <p className="text-gold">{formatPrice(price * line.qty, lang)}</p>
              {line.qty > max && <p className="font-bold">{checkout.gone}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" className={round} aria-label={t.decrease} disabled={line.qty <= 1} onClick={() => setQty(line, line.qty - 1)}>−</button>
                <output className="min-w-6 text-center font-bold">{line.qty}</output>
                <button type="button" className={round} aria-label={t.increase} disabled={line.qty >= max} onClick={() => setQty(line, line.qty + 1)}>+</button>
                <button type="button" className="min-h-11 px-3 text-sm underline opacity-85" onClick={() => setQty(line, 0)}>{t.remove}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Checkout
        lang={lang}
        t={checkout}
        totalLabel={t.total}
        subtotal={subtotal}
        blocked={lines.some((l) => l.line.qty > l.max)}
        items={lines.map((l) => ({ slug: l.line.slug, key: l.key, qty: l.line.qty }))}
        onPlaced={(order) => {
          lines.forEach((l) => setQty(l.line, 0));
          rememberOrder(order.id);
          setPlaced(order);
        }}
      />
    </>
  );
}
