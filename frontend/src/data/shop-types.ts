// What the backend's public shop endpoints return (backend/src/routes/store.ts).

export type Text = { ar: string; en: string };

/** One item in GET /products. */
export type ShopProduct = {
  slug: string;
  category: string;
  name: Text;
  image: string | null;
  price: number;
  discount: number;
  finalPrice: number;
  madeToOrder: boolean;
  soldOut: boolean;
  colors: Text[];
};

/** One colour/size combination. Stock is null for made-to-order pieces. */
export type ShopVariant = { id: string; color: Text | null; size: string | null; stock: number | null };

/** GET /products/:slug */
export type ShopProductDetail = Omit<ShopProduct, "image" | "soldOut" | "colors"> & {
  images: string[];
  leadDays: number | null;
  variants: ShopVariant[];
};

/** How many of this variant a customer can still order. */
export const availableOf = (p: Pick<ShopProductDetail, "madeToOrder">, v: ShopVariant | undefined) =>
  !v ? 0 : p.madeToOrder ? 99 : (v.stock ?? 0);
