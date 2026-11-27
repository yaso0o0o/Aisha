import { notFound } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/Header";
import ProductSearch from "@/components/ProductSearch";
import { getProducts } from "@/data/shop";
import { getDictionary, hasLocale, type Locale } from "../dictionaries";

export default async function Products({ params }: PageProps<"/[lang]/products">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} path="/products" nav={t.nav} switchLanguage={t.switchLanguage} />
      <main className="signs min-h-svh px-6 pt-32 pb-20">
        <div className="wrap">
          <h1 className="font-display text-4xl font-bold md:text-6xl">{t.nav.products}</h1>
          <Suspense fallback={<ProductsLoading />}>
            <ProductList lang={lang} t={t.search} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

/** Read from the backend on every visit, so the shop matches the dashboard. */
async function ProductList({ lang, t }: { lang: Locale; t: Parameters<typeof ProductSearch>[0]["t"] }) {
  return <ProductSearch lang={lang} t={t} products={await getProducts()} />;
}

function ProductsLoading() {
  return (
    <ul aria-busy="true" className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-8">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="aspect-[3/4] animate-pulse rounded-t-full rounded-b-2xl bg-linen/10" />
      ))}
    </ul>
  );
}
