"use client";

import { useState, type FormEvent } from "react";
import { couponStore, findCoupon, instapayStore, placeOrder, StockError, zoneStore, type Order } from "@/data/admin";
import { readPhoto } from "@/data/photo";
import { formatPrice } from "@/data/products";

export type CheckoutLabels = Record<
  | "title" | "name" | "phone" | "address" | "zone" | "choose" | "payment" | "cod" | "instapay" | "wallet"
  | "coupon" | "badCoupon" | "subtotal" | "discount" | "shipping" | "confirm" | "invalid" | "stock"
  | "failed" | "done" | "send" | "gone" | "transferTo" | "accountName" | "checkName" | "copy" | "copied"
  | "proof" | "needProof" | "badFile",
  string
>;

type Props = {
  lang: "ar" | "en";
  t: CheckoutLabels;
  totalLabel: string;
  items: { slug: string; key: string; qty: number }[];
  subtotal: number;
  blocked: boolean;
  onPlaced: (order: Order) => void;
};

const input = "mt-1 min-h-12 w-full rounded-lg border border-gold/60 bg-navy-deep px-3 text-base";

export default function Checkout({ lang, t, totalLabel, items, subtotal, blocked, onPlaced }: Props) {
  const zones = zoneStore.useList();
  const coupons = couponStore.useList();
  const [form, setForm] = useState({ name: "", phone: "", address: "", zoneId: "", code: "", payment: "cod" as Order["payment"] });
  const [error, setError] = useState("");
  const [proof, setProof] = useState("");
  const [copied, setCopied] = useState(false);
  const account = instapayStore.useList()[0];
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const zone = zones.find((z) => z.id === form.zoneId);
  const coupon = form.code.trim() ? findCoupon(coupons, form.code, subtotal) : undefined;
  const discount = coupon ? Math.round((subtotal * coupon.percent) / 100) : 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    const phone = form.phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[\s-]/g, "");
    if (!form.name.trim() || !form.address.trim() || !zone || !/^\+?\d{10,15}$/.test(phone)) return setError(t.invalid);
    const instapay = form.payment === "instapay" && account;
    if (instapay && !proof) return setError(t.needProof);
    try {
      onPlaced(placeOrder({ ...form, payment: instapay ? "instapay" : form.payment === "instapay" ? "cod" : form.payment, proof: instapay ? proof : undefined, phone, name: form.name.trim(), address: form.address.trim(), items }));
    } catch (err) {
      setError(err instanceof StockError ? t.stock : t.failed);
    }
  }

  const total = subtotal - discount + (zone?.price ?? 0);

  const rows = [
    [t.subtotal, subtotal],
    ...(discount ? [[t.discount, -discount]] : []),
    ...(zone ? [[t.shipping, zone.price]] : []),
  ] as [string, number][];

  return (
    <form onSubmit={submit} noValidate className="mt-10 space-y-4">
      <h2 className="font-display text-3xl font-bold">{t.title}</h2>
      <label className="block">
        {t.name}
        <input className={input} autoComplete="name" value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label className="block">
        {t.phone}
        <input className={input} type="tel" dir="ltr" autoComplete="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
      </label>
      <label className="block">
        {t.zone}
        <select className={input} value={form.zoneId} onChange={(e) => set({ zoneId: e.target.value })}>
          <option value="">{t.choose}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {(lang === "ar" ? z.nameAr : z.nameEn || z.nameAr) + " - " + formatPrice(z.price, lang)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        {t.address}
        <textarea className={`${input} py-2`} rows={3} autoComplete="street-address" value={form.address} onChange={(e) => set({ address: e.target.value })} />
      </label>
      <label className="block">
        {t.payment}
        <select className={input} value={form.payment} onChange={(e) => set({ payment: e.target.value as Order["payment"] })}>
          <option value="cod">{t.cod}</option>
          {account && <option value="instapay">{t.instapay}</option>}
          <option value="wallet">{t.wallet}</option>
        </select>
      </label>
      <label className="block">
        {t.coupon}
        <input className={input} dir="ltr" value={form.code} onChange={(e) => set({ code: e.target.value })} />
        {form.code.trim() && !coupon && <span className="mt-1 block text-gold">{t.badCoupon}</span>}
      </label>

      <dl className="space-y-1 border-t border-gold/50 pt-4">
        {rows.map(([name, value]) => (
          <div key={name} className="flex justify-between">
            <dt>{name}</dt>
            <dd>{formatPrice(value, lang)}</dd>
          </div>
        ))}
        <div className="flex justify-between pt-2 text-2xl font-bold">
          <dt>{totalLabel}</dt>
          <dd className="text-gold">{formatPrice(total, lang)}</dd>
        </div>
      </dl>

      {form.payment === "instapay" && account && (
        <div className="space-y-3 rounded-2xl border-2 border-gold p-5">
          <p>{t.transferTo.replace("{total}", formatPrice(total, lang))}</p>
          <p className="flex flex-wrap items-center gap-3">
            <bdi dir="ltr" className="text-2xl font-bold text-gold">{account.number}</bdi>
            <button
              type="button"
              className="min-h-11 rounded-full border border-gold px-4"
              onClick={() => navigator.clipboard?.writeText(account.number).then(() => setCopied(true), () => {})}
            >
              {copied ? t.copied : t.copy}
            </button>
          </p>
          <p>{t.accountName}: <strong>{account.name}</strong></p>
          <p className="text-sm">{t.checkName}</p>
          <label className="block font-bold">
            {t.proof}
            <input
              type="file"
              accept="image/*"
              className={`${input} py-2`}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setProof("");
                if (!file) return;
                try {
                  setProof(await readPhoto(file, 1100));
                  setError("");
                } catch {
                  setError(t.badFile);
                }
              }}
            />
          </label>
          {proof && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL
            <img src={proof} alt="" className="max-h-52 rounded-lg" />
          )}
        </div>
      )}

      <p role="alert" className="min-h-6 font-bold text-gold">{blocked ? t.stock : error}</p>
      <button type="submit" disabled={blocked} className="btn btn-solid w-full disabled:opacity-50 md:w-auto">{t.confirm}</button>
    </form>
  );
}
