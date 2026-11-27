"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, type CustomerOrder } from "@/data/api";
import { setQty, useCart } from "@/data/cart";
import { rememberOrder } from "@/data/mine";
import { formatPrice } from "@/data/products";
import { availableOf, type ShopProductDetail } from "@/data/shop-types";
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

const noSubscribe = () => () => {};

const round ="grid h-11 w-11 place-items-center rounded-full border border-gold text-xl hover:bg-gold/20 disabled:opacity-40";

/** The products in the cart, read fresh from the server. null while loading; missing means hidden or deleted. */
function useCartProducts(slugs: string[], version: number) {
  // Remember which cart the answer is for, so an older answer never shows as "empty cart".
  const [found, setFound] = useState<{ for: string; products: Record<string, ShopProductDetail | null> } | null>(null);
  const wanted = [...new Set(slugs)].sort().join(",");

  useEffect(() => {
    let live = true;
    const list = wanted ? wanted.split(",") : [];
    Promise.all(
      list.map((slug) =>
        api<ShopProductDetail>(`/products/${encodeURIComponent(slug)}`)
          .then((p) => [slug, p] as const)
          .catch(() => [slug, null] as const),
      ),
    ).then((pairs) => live && setFound({ for: wanted, products: Object.fromEntries(pairs) }));
    return () => {
      live = false;
    };
  }, [wanted, version]);

  return found?.for === wanted ? found.products : null;
}

export default function CartView({ lang, t, checkout, status }: { lang: "ar" | "en"; t: Labels; checkout: CheckoutLabels; status: StatusLabels }) {
  const cart = useCart();
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  // Bumped when the server says stock changed, to read the cart products again.
  const [version, setVersion] = useState(0);
  const products = useCartProducts(cart.map((l) => l.slug), version);
  const [placed, setPlaced] = useState<CustomerOrder | null>(null);

  const lines = cart.flatMap((line) => {
    const product = products?.[line.slug];
    const variant = product?.variants.find((v) => v.id === line.variantId);
    if (!product || !variant) return [];
    const name = product.name[lang] || product.name.ar;
    const colorName = variant.color && (variant.color[lang] || variant.color.ar);
    const details = [colorName && `${t.color}: ${colorName}`, variant.size && `${t.size}: ${variant.size}`].filter(Boolean).join(" / ");
    return [{ line, product, name, details, max: availableOf(product, variant), price: product.finalPrice }];
  });

  if (placed) {
    const message = [
      t.message,
      `#${placed.code}`,
      ...placed.items.map((l) => `- ${l.name} (${l.label}) × ${l.qty}`),
      `${t.total}: ${formatPrice(placed.total, lang)}`,
    ].join("\n");
    return (
      <div role="status" className="mt-10">
        <p className="text-2xl font-bold">{checkout.done} <bdi className="text-gold">{placed.code}</bdi></p>
        <p className="mt-2 text-lg">{t.total}: {formatPrice(placed.total, lang)}</p>
        <OrderStatus order={placed} t={status} />
        <Link className="mt-4 block font-bold text-gold underline" href={`/${lang}/orders`}>{status.mine}</Link>
        <a className="btn btn-solid mt-6" href={`https://wa.me/201281227555?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          {checkout.send}
        </a>
      </div>
    );
  }

  // The server cannot see the cart, so wait for the browser before saying it is empty.
  if (!inBrowser || (cart.length && !products)) {
    return <p role="status" aria-busy="true" className="mt-10 h-24 animate-pulse rounded-2xl bg-linen/10" />;
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
        {lines.map(({ line, product, name, details, max, price }) => (
          <li key={line.variantId} className="flex gap-4 py-5">
            <Link href={`/${lang}/products/${line.slug}`} className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-t-full rounded-b-lg border border-gold/50">
              {product.images[0] && <Image src={product.images[0]} alt={name} fill sizes="96px" className="object-cover" />}
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
        items={lines.map((l) => ({ variantId: l.line.variantId, qty: l.line.qty }))}
        onPlaced={({ token, ...order }) => {
          lines.forEach((l) => setQty(l.line, 0));
          rememberOrder({ code: order.code, token });
          setPlaced(order);
        }}
        onStockChanged={() => setVersion((v) => v + 1)}
      />
    </>
  );
}
