import "server-only";
// Shop data read on the server from the backend, fresh on every request,
// so price, stock and new products from the dashboard show at once.
import type { ShopProduct, ShopProductDetail } from "./shop-types";

const API = process.env.API_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const getProducts = async () => (await get<ShopProduct[]>("/products")) ?? [];

export const getProduct = (slug: string) => get<ShopProductDetail>(`/products/${encodeURIComponent(slug)}`);
