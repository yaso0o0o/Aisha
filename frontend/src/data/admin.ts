// Shop and dashboard data, kept in this browser only until the API exists.
// The backend must take over every function here, especially placeOrder:
// only a server can stop two customers buying the same last piece.
import { products, type CategoryId } from "./products";
import { createStore } from "./store";

export type AdminProduct = {
  slug: string;
  nameAr: string;
  nameEn: string;
  category: CategoryId;
  image: string;
  price: number;
  /** Percent off, 0 means no discount. */
  discount: number;
  colors: string[];
  sizes: string[];
  madeToOrder: boolean;
  days: number;
  /** Stock per variant, keyed by variantKey. */
  stock: Record<string, number>;
  hidden: boolean;
};

export const variantKey = (color = "", size = "") => `${color}|${size}`;

/** Every colour/size combination; a product with neither still has one. */
export const variants = (p: Pick<AdminProduct, "colors" | "sizes">) =>
  (p.colors.length ? p.colors : [""]).flatMap((color) =>
    (p.sizes.length ? p.sizes : [""]).map((size) => ({
      key: variantKey(color, size),
      label: [color, size].filter(Boolean).join(" / ") || "القطعة",
    })),
  );

export const totalStock = (p: AdminProduct) =>
  variants(p).reduce((sum, v) => sum + (p.stock[v.key] ?? 0), 0);

export const soldOut = (p: AdminProduct) => !p.madeToOrder && totalStock(p) === 0;

/** How many of this variant can still be ordered. */
export const available = (p: AdminProduct, key: string) =>
  p.hidden ? 0 : p.madeToOrder ? 99 : (p.stock[key] ?? 0);

export const finalPrice = (p: Pick<AdminProduct, "price" | "discount">) =>
  Math.round(p.price * (1 - p.discount / 100));

const SAMPLE_STOCK = 3;

const seed: AdminProduct[] = products.map((p) => {
  const base = {
    slug: p.slug,
    nameAr: p.name.ar,
    nameEn: p.name.en,
    category: p.category,
    image: p.image,
    price: p.price,
    discount: 0,
    colors: p.colors?.map((c) => c.ar) ?? [],
    sizes: p.sizes ?? [],
    madeToOrder: Boolean(p.madeToOrderDays),
    days: p.madeToOrderDays ?? 14,
    hidden: false,
  };
  return { ...base, stock: Object.fromEntries(variants(base).map((v) => [v.key, SAMPLE_STOCK])) };
});

const productStore = createStore<AdminProduct>("aisha-admin-products", seed);

export const useAdminProducts = productStore.useList;

export function saveProduct(product: AdminProduct) {
  const list = productStore.refresh();
  productStore.write(
    list.some((p) => p.slug === product.slug)
      ? list.map((p) => (p.slug === product.slug ? product : p))
      : [product, ...list],
  );
}

export const removeProduct = (slug: string) =>
  productStore.write(productStore.refresh().filter((p) => p.slug !== slug));

/* ---------- coupons and shipping ---------- */

export type Coupon = { code: string; percent: number; min: number; until: string; active: boolean };
export type Zone = { id: string; nameAr: string; nameEn: string; price: number };

export const couponStore = createStore<Coupon>("aisha-coupons", []);

// Sample shipping prices until the owner sets the real ones.
export const zoneStore = createStore<Zone>("aisha-zones", [
  { id: "cairo", nameAr: "القاهرة والجيزة", nameEn: "Cairo and Giza", price: 60 },
  { id: "alex", nameAr: "الإسكندرية", nameEn: "Alexandria", price: 75 },
  { id: "egypt", nameAr: "باقي المحافظات", nameEn: "Other governorates", price: 100 },
  { id: "world", nameAr: "خارج مصر", nameEn: "Outside Egypt", price: 900 },
]);

/** The coupon for this code if it can be used on this subtotal today. */
export function findCoupon(coupons: Coupon[], code: string, subtotal: number) {
  const today = new Date().toLocaleDateString("en-CA");
  return coupons.find(
    (c) =>
      c.code === code.trim().toUpperCase() &&
      c.active &&
      subtotal >= c.min &&
      (!c.until || c.until >= today),
  );
}

/* ---------- InstaPay ---------- */

/** Set by the owner in the dashboard. InstaPay is offered only when both are filled. */
export type Instapay = { number: string; name: string };

export const instapayStore = createStore<Instapay>("aisha-instapay", []);

/** Where a manual transfer stands until the owner checks the money arrived. */
export type Transfer = "awaiting" | "approved" | "rejected";

/* ---------- orders ---------- */

export const orderStatuses = {
  new: "جديد",
  confirmed: "متأكد",
  shipped: "اتشحن",
  delivered: "اتسلم",
  cancelled: "ملغي",
} as const;

export const payments = { cod: "كاش عند الاستلام", instapay: "InstaPay", wallet: "محفظة" } as const;

export const orderStatusesEn: Record<keyof typeof orderStatuses, string> = {
  new: "New",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const paymentsEn: Record<keyof typeof payments, string> = { cod: "Cash on delivery", instapay: "InstaPay", wallet: "Wallet" };

export type OrderLine = { slug: string; name: string; key: string; label: string; qty: number; price: number };

export type Order = {
  id: string;
  date: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  payment: keyof typeof payments;
  lines: OrderLine[];
  coupon: string;
  discount: number;
  shipping: number;
  total: number;
  status: keyof typeof orderStatuses;
  paid: boolean;
  /** InstaPay only: screenshot of the transfer, and the owner's decision. */
  proof?: string;
  transfer?: Transfer;
};

export const orderStore = createStore<Order>("aisha-orders", []);

export class StockError extends Error {
  constructor(public slug: string) {
    super("out of stock");
  }
}

type NewOrder = Pick<Order, "name" | "phone" | "address" | "payment" | "proof"> & {
  zoneId: string;
  code: string;
  items: { slug: string; key: string; qty: number }[];
};

/** Re-checks stock, takes the pieces out of it, then records the order. */
export function placeOrder({ items, zoneId, code, proof, ...customer }: NewOrder): Order {
  const transfer = customer.payment === "instapay";
  if (transfer && !proof) throw new Error("missing transfer screenshot");
  const catalogue = productStore.refresh().map((p) => ({ ...p, stock: { ...p.stock } }));

  const lines = items.map(({ slug, key, qty }) => {
    const p = catalogue.find((x) => x.slug === slug);
    if (!p || available(p, key) < qty) throw new StockError(slug);
    if (!p.madeToOrder) p.stock[key] -= qty;
    const label = variants(p).find((v) => v.key === key)?.label ?? "";
    return { slug, name: p.nameAr, key, label, qty, price: finalPrice(p) };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const coupon = findCoupon(couponStore.refresh(), code, subtotal);
  const discount = coupon ? Math.round((subtotal * coupon.percent) / 100) : 0;
  const zone = zoneStore.refresh().find((z) => z.id === zoneId);
  if (!zone) throw new Error("unknown shipping zone");

  const order: Order = {
    ...customer,
    id: Date.now().toString(36).toUpperCase(),
    date: new Date().toISOString(),
    zone: zone.nameAr,
    lines,
    coupon: coupon?.code ?? "",
    discount,
    shipping: zone.price,
    total: subtotal - discount + zone.price,
    status: "new",
    paid: false,
    ...(transfer ? { proof, transfer: "awaiting" as const } : {}),
  };
  // the order holds the screenshot, so it is the write most likely to fail: do it first
  orderStore.write([order, ...orderStore.refresh()]);
  productStore.write(catalogue);
  return order;
}

/** The owner's answer on a transfer. Rejecting cancels the order and frees its pieces. */
export function reviewTransfer(id: string, approved: boolean) {
  if (orderStore.refresh().find((o) => o.id === id)?.transfer !== "awaiting") return;
  updateOrder(
    id,
    approved
      ? { transfer: "approved", paid: true, status: "confirmed" }
      : { transfer: "rejected", status: "cancelled" },
  );
}

/** Cancelling puts the pieces back in stock, once. A cancelled order stays cancelled. */
export function updateOrder(id: string, patch: Partial<Pick<Order, "status" | "paid" | "transfer">>) {
  const orders = orderStore.refresh();
  const order = orders.find((o) => o.id === id);
  if (!order || order.status === "cancelled") return;
  if (patch.status === "cancelled") {
    productStore.write(
      productStore.refresh().map((p) => {
        const back = order.lines.filter((l) => l.slug === p.slug);
        if (!back.length || p.madeToOrder) return p;
        const stock = { ...p.stock };
        back.forEach((l) => (stock[l.key] = (stock[l.key] ?? 0) + l.qty));
        return { ...p, stock };
      }),
    );
  }
  orderStore.write(orders.map((o) => (o.id === id ? { ...o, ...patch } : o)));
}
