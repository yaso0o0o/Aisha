"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  checkCoupon,
  paymentMethods,
  sendOrder,
  shopZones,
  type CouponCheck,
  type CustomerOrder,
  type PaymentMethods,
  type PaymentName,
  type ShopZone,
} from "@/data/api";
import { formatPrice } from "@/data/products";

export type CheckoutLabels = Record<
  | "title" | "name" | "phone" | "address" | "zone" | "choose" | "payment" | "cod" | "instapay" | "wallet"
  | "coupon" | "badCoupon" | "couponMin" | "couponOk" | "noZones" | "subtotal" | "discount" | "shipping" | "confirm" | "invalid" | "stock"
  | "failed" | "done" | "send" | "gone" | "transferTo" | "accountName" | "checkName" | "copy" | "copied"
  | "proof" | "needProof" | "badFile" | "sending" | "tooBig",
  string
>;

type Props = {
  lang: "ar" | "en";
  t: CheckoutLabels;
  totalLabel: string;
  items: { variantId: string; qty: number }[];
  /** Products total as the cart shows it; the server computes the real one. */
  subtotal: number;
  blocked: boolean;
  onPlaced: (order: CustomerOrder & { token: string }) => void;
  /** Stock changed since the cart loaded: read it again. */
  onStockChanged: () => void;
};

const input = "mt-1 min-h-12 w-full rounded-lg border border-gold/60 bg-navy-deep px-3 text-base";

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, "");

export default function Checkout({ lang, t, totalLabel, items, subtotal, blocked, onPlaced, onStockChanged }: Props) {
  const zones = useZones();
  const methods = usePaymentMethods();
  const [form, setForm] = useState({ name: "", phone: "", address: "", zoneId: "", code: "", payment: "cod" as PaymentName });
  const [error, setError] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  // Same order sent again (double click, lost answer) keeps its key, so the server returns
  // the first order. Any change to the form or the cart makes it a new order with a new key.
  const sent = useRef<{ order: string; key: string } | null>(null);
  const account = methods?.instapay ?? null;
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const zone = zones?.find((z) => z.id === form.zoneId);
  const check = useCouponCheck(form.code, subtotal);
  const coupon = check?.valid ? check : null;
  const discount = coupon?.discount ?? 0;
  const payment: PaymentName = form.payment === "instapay" && !account ? "cod" : form.payment;

  useEffect(() => {
    if (!proof) return;
    const url = URL.createObjectURL(proof);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preview follows the picked file
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proof]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const phone = form.phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[\s-]/g, "");
    if (!form.name.trim() || form.address.trim().length < 5 || !zone || !/^\+?\d{10,15}$/.test(phone)) return setError(t.invalid);
    if (payment === "instapay" && !proof) return setError(t.needProof);
    setSending(true);
    setError("");
    // The server checks the coupon again, so it is sent even if the check above has not answered yet.
    const body = { name: form.name.trim(), phone, address: form.address.trim(), zoneId: zone.id, payment, coupon: form.code.trim(), items };
    const signature = JSON.stringify([body, proof?.name, proof?.size]);
    if (sent.current?.order !== signature) sent.current = { order: signature, key: newKey() };
    try {
      const order = await sendOrder(
        { ...body, idempotencyKey: sent.current.key },
        payment === "instapay" ? (proof ?? undefined) : undefined,
      );
      onPlaced(order);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code = err instanceof ApiError ? err.body.error : "";
      if (status === 409) onStockChanged();
      setError(
        status === 409 ? t.stock
          : code === "invalid_coupon" ? t.badCoupon
            : code === "not_an_image" ? t.badFile
              : status === 413 ? t.tooBig
                : status === 422 && code !== "instapay_off" ? t.invalid
                  : t.failed,
      );
      setSending(false);
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
          {zones?.map((z) => (
            <option key={z.id} value={z.id}>
              {(z.name[lang] || z.name.ar) + " - " + formatPrice(z.price, lang)}
            </option>
          ))}
        </select>
        {zones && !zones.length && <span className="mt-1 block text-gold">{t.noZones}</span>}
      </label>
      <label className="block">
        {t.address}
        <textarea className={`${input} py-2`} rows={3} autoComplete="street-address" value={form.address} onChange={(e) => set({ address: e.target.value })} />
      </label>
      <label className="block">
        {t.payment}
        <select className={input} value={payment} onChange={(e) => set({ payment: e.target.value as PaymentName })}>
          <option value="cod">{t.cod}</option>
          {account && <option value="instapay">{t.instapay}</option>}
          <option value="wallet">{t.wallet}</option>
        </select>
      </label>
      <label className="block">
        {t.coupon}
        <input className={input} dir="ltr" value={form.code} onChange={(e) => set({ code: e.target.value })} />
        {check && (
          <span role="status" className="mt-1 block text-gold">
            {check.valid
              ? t.couponOk.replace("{percent}", String(check.percent))
              : check.reason === "below_minimum"
                ? t.couponMin.replace("{min}", formatPrice(check.minTotal, lang))
                : t.badCoupon}
          </span>
        )}
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

      {payment === "instapay" && account && (
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
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setPreview("");
                setError("");
                if (file && !file.type.startsWith("image/")) {
                  setProof(null);
                  return setError(t.badFile);
                }
                if (file && file.size > 8 * 1024 * 1024) {
                  setProof(null);
                  return setError(t.tooBig);
                }
                setProof(file);
              }}
            />
          </label>
          {proof && preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file
            <img src={preview} alt="" className="max-h-52 rounded-lg" />
          )}
        </div>
      )}

      <p role="alert" className="min-h-6 font-bold text-gold">{blocked ? t.stock : error}</p>
      <button type="submit" disabled={blocked || sending} className="btn btn-solid w-full disabled:opacity-50 md:w-auto">
        {sending ? t.sending : t.confirm}
      </button>
    </form>
  );
}

/** Active shipping zones from the server; null while loading. */
function useZones() {
  const [zones, setZones] = useState<ShopZone[] | null>(null);
  useEffect(() => {
    let live = true;
    shopZones()
      .then((z) => live && setZones(z))
      .catch(() => live && setZones([]));
    return () => {
      live = false;
    };
  }, []);
  return zones;
}

/** Which payment methods the shop offers, with the InstaPay number when it is set. */
function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  useEffect(() => {
    let live = true;
    paymentMethods()
      .then((m) => live && setMethods(m))
      .catch(() => live && setMethods({ cod: true, wallet: true, instapay: null }));
    return () => {
      live = false;
    };
  }, []);
  return methods;
}

/** Asks the server about the code a moment after the customer stops typing. */
function useCouponCheck(code: string, subtotal: number) {
  const key = `${code.trim().toUpperCase()}|${subtotal}`;
  const [result, setResult] = useState<{ for: string; check: CouponCheck } | null>(null);
  useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed) return;
    let live = true;
    const timer = setTimeout(() => {
      checkCoupon(trimmed, subtotal)
        .then((check) => live && setResult({ for: key, check }))
        .catch(() => live && setResult({ for: key, check: { valid: false, reason: "invalid" } }));
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [code, subtotal, key]);
  // An answer for an older code or total is never shown or applied.
  return code.trim() && result?.for === key ? result.check : null;
}
