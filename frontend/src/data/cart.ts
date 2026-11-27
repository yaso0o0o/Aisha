// Cart kept in the browser. Each line points at one variant (colour/size) by its
// database id; price and stock are always read fresh from the server.
import { useSyncExternalStore } from "react";

export type CartLine = { slug: string; variantId: string; qty: number };

const KEY = "aisha-cart";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached = EMPTY;

function read(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached; // storage blocked: keep the cart in memory
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed: unknown = JSON.parse(raw ?? "[]");
      // Lines saved before the shop used the server have no variantId; drop them.
      cached = Array.isArray(parsed) ? parsed.filter((l) => typeof l?.variantId === "string") : EMPTY;
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
}

function write(lines: CartLine[]) {
  cached = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
    cachedRaw = localStorage.getItem(KEY);
  } catch {}
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

const same = (a: CartLine, b: CartLine) => a.variantId === b.variantId;

export const useCart = () => useSyncExternalStore(subscribe, read, () => EMPTY);

export function addToCart(line: CartLine) {
  const lines = read();
  write(
    lines.some((l) => same(l, line))
      ? lines.map((l) => (same(l, line) ? { ...l, qty: l.qty + line.qty } : l))
      : [...lines, line],
  );
}

/** A quantity of 0 removes the line. */
export function setQty(line: CartLine, qty: number) {
  write(read().flatMap((l) => (!same(l, line) ? [l] : qty > 0 ? [{ ...l, qty }] : [])));
}
