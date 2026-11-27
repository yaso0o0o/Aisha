// Calls to the backend. They go through /api on this site (see next.config.ts),
// so the admin session cookie belongs to the shop's own domain.

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; field?: string } = {},
  ) {
    super(body.error ?? `HTTP ${status}`);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export type AdminUser = { email: string };

export const adminLogin = (email: string, password: string) =>
  api<AdminUser>("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const adminLogout = () => api<void>("/admin/logout", { method: "POST" });

export const adminMe = () => api<AdminUser>("/admin/me");

/** Name of the cookie the backend sets; only its presence is checked here. */
export const SESSION_COOKIE = "aisha_session";

/* ---------- dashboard products ---------- */

export type ProductVariant = { id?: string; colorAr: string; colorEn: string; size: string; stock: number };

export type ApiProduct = {
  id: string;
  slug: string;
  category: string;
  nameAr: string;
  nameEn: string;
  images: string[];
  price: number;
  discount: number;
  madeToOrder: boolean;
  leadDays: number | null;
  hidden: boolean;
  variants: ProductVariant[];
  /** Sent back when saving, so an older copy never overwrites a newer one. */
  updatedAt: string;
};

export type ProductInput = Omit<ApiProduct, "id" | "slug" | "updatedAt">;

export const listProducts = () => api<ApiProduct[]>("/admin/products");

export const createProduct = (p: ProductInput) =>
  api<ApiProduct>("/admin/products", { method: "POST", body: JSON.stringify(p) });

export const updateProduct = (id: string, patch: Partial<ProductInput> & { updatedAt: string }) =>
  api<ApiProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteProduct = (id: string) =>
  api<{ archived: boolean }>(`/admin/products/${id}`, { method: "DELETE" });

/**
 * Hosting refuses request bodies over 4.5 MB and phone photos are often bigger,
 * so large ones are shrunk first. The server still checks and re-encodes them.
 */
async function shrinkImage(file: File) {
  if (file.size <= 3 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // not an image the browser can read: let the server say so
  }
}

/** Uploads a product photo and returns the address to show it from. */
export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", await shrinkImage(file));
  const res = await fetch("/api/admin/uploads", { method: "POST", body: form, credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return ((await res.json()) as { url: string }).url;
}

export const totalStock = (p: Pick<ApiProduct, "variants">) => p.variants.reduce((sum, v) => sum + v.stock, 0);

/* ---------- shipping zones ---------- */

export type AdminZone = { id: string; nameAr: string; nameEn: string; price: number; active: boolean; sort: number };

export const listZones = () => api<AdminZone[]>("/admin/shipping-zones");

export const createZone = (z: Pick<AdminZone, "nameAr" | "nameEn" | "price">) =>
  api<AdminZone>("/admin/shipping-zones", { method: "POST", body: JSON.stringify(z) });

export const updateZone = (id: string, patch: Partial<Omit<AdminZone, "id">>) =>
  api<AdminZone>(`/admin/shipping-zones/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteZone = (id: string) => api<void>(`/admin/shipping-zones/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Active zones for the checkout. */
export type ShopZone = { id: string; name: { ar: string; en: string }; price: number };

export const shopZones = () => api<ShopZone[]>("/shipping-zones");

/* ---------- coupons ---------- */

export type AdminCoupon = { id: string; code: string; percent: number; minTotal: number; validUntil: string | null; active: boolean };

export const listCoupons = () => api<AdminCoupon[]>("/admin/coupons");

export const createCoupon = (c: Omit<AdminCoupon, "id" | "active">) =>
  api<AdminCoupon>("/admin/coupons", { method: "POST", body: JSON.stringify(c) });

export const updateCoupon = (id: string, patch: Partial<Omit<AdminCoupon, "id">>) =>
  api<AdminCoupon>(`/admin/coupons/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const deleteCoupon = (id: string) => api<void>(`/admin/coupons/${id}`, { method: "DELETE" });

export type CouponCheck =
  | { valid: true; code: string; percent: number; discount: number }
  | { valid: false; reason: "invalid" }
  | { valid: false; reason: "below_minimum"; minTotal: number };

/** Asks the server if a code works on this products total. */
export const checkCoupon = (code: string, subtotal: number) =>
  api<CouponCheck>("/coupons/check", { method: "POST", body: JSON.stringify({ code, subtotal }) });

/* ---------- orders ---------- */

export type OrderStatusName = "new" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type TransferStatus = "awaiting" | "approved" | "rejected";
export type PaymentName = "cod" | "instapay" | "wallet";

export type OrderItem = { name: string; label: string; qty: number; unitPrice: number };

/** What a customer sees about their own order. */
export type CustomerOrder = {
  code: string;
  status: OrderStatusName;
  transfer: TransferStatus | null;
  paid: boolean;
  payment: PaymentName;
  zone: string;
  subtotal: number;
  discount: number;
  coupon: string | null;
  shipping: number;
  total: number;
  items: OrderItem[];
  createdAt: string;
};

export type NewOrder = {
  name: string;
  phone: string;
  address: string;
  zoneId: string;
  payment: PaymentName;
  coupon: string;
  items: { variantId: string; qty: number }[];
  /** Same key for the same checkout, so a double click makes one order. */
  idempotencyKey: string;
};

/** Sends the order; the server checks stock and computes every price. */
export async function sendOrder(order: NewOrder, proof?: File) {
  if (!proof) return api<CustomerOrder & { token: string }>("/orders", { method: "POST", body: JSON.stringify(order) });
  const form = new FormData();
  form.append("order", JSON.stringify(order));
  form.append("proof", await shrinkImage(proof));
  const res = await fetch("/api/orders", { method: "POST", body: form, credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return (await res.json()) as CustomerOrder & { token: string };
}

export const getOrder = (code: string, token: string) =>
  api<CustomerOrder>(`/orders/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`);

export type PaymentMethods = { cod: boolean; wallet: boolean; instapay: { number: string; name: string } | null };

export const paymentMethods = () => api<PaymentMethods>("/payment-methods");

/* ---------- dashboard orders ---------- */

export type AdminOrder = Omit<CustomerOrder, "items"> & {
  id: string;
  name: string;
  phone: string;
  address: string;
  items: (OrderItem & { id: string; productId: string | null })[];
  hasProof: boolean;
};

export const listOrders = () => api<AdminOrder[]>("/admin/orders");

export const patchOrder = (id: string, patch: { status?: OrderStatusName; paid?: boolean }) =>
  api<AdminOrder>(`/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export const decideTransfer = (id: string, approved: boolean) =>
  api<AdminOrder>(`/admin/orders/${id}/transfer`, { method: "POST", body: JSON.stringify({ approved }) });

/** Address of a transfer screenshot; only works for a logged-in admin. */
export const proofUrl = (id: string) => `/api/admin/orders/${id}/proof`;

export type InstapayAccount = { number: string; name: string };

export const getInstapay = () => api<InstapayAccount>("/admin/settings/instapay");

export const saveInstapay = (account: InstapayAccount) =>
  api<InstapayAccount>("/admin/settings/instapay", { method: "PUT", body: JSON.stringify(account) });
