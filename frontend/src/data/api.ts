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

/** Uploads a product photo and returns the address to show it from. */
export async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/uploads", { method: "POST", body: form, credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return ((await res.json()) as { url: string }).url;
}

export const totalStock = (p: Pick<ApiProduct, "variants">) => p.variants.reduce((sum, v) => sum + v.stock, 0);
