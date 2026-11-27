// Coupon rules from docs/backend-spec.md: code in capitals, 1-90% off the products only
// (never shipping), works when active, the products total reaches min_total, and
// valid_until is empty or not passed yet (Cairo time, the last day itself counts).
import type { Coupon } from "@prisma/client";
import { prisma } from "./db.js";

export const normalizeCode = (code: string) => code.trim().toUpperCase();

/** Today's date in Cairo as YYYY-MM-DD. */
export const cairoToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(now);

/** A @db.Date value as YYYY-MM-DD. */
export const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

export const couponDiscount = (subtotal: number, percent: number) => Math.round((subtotal * percent) / 100);

export type CouponProblem = "not_found" | "inactive" | "expired" | "below_minimum";

/** Why this coupon cannot be used on this products total, or null when it can. */
export function couponProblem(c: Coupon | null, subtotal: number, now = new Date()): CouponProblem | null {
  if (!c) return "not_found";
  if (!c.active) return "inactive";
  if (c.validUntil && dateOnly(c.validUntil) < cairoToday(now)) return "expired";
  if (subtotal < c.minTotal) return "below_minimum";
  return null;
}

/** The coupon and its discount if it can be used, otherwise the reason it cannot. */
export async function checkCoupon(code: string, subtotal: number, now = new Date()) {
  const coupon = await prisma.coupon.findUnique({ where: { code: normalizeCode(code) } });
  const problem = couponProblem(coupon, subtotal, now);
  if (problem) return { ok: false as const, problem };
  return { ok: true as const, coupon: coupon!, discount: couponDiscount(subtotal, coupon!.percent) };
}
