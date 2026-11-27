import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Header from "@/components/Header";
import ProductBuy from "@/components/ProductBuy";
import { getProduct } from "@/data/shop";
import { getDictionary, hasLocale } from "../../dictionaries";

export default function ProductPage({ params }: PageProps<"/[lang]/products/[slug]">) {
  return (
    <Suspense fallback={<main aria-busy="true" className="signs min-h-svh" />}>
      <Product params={params} />
    </Suspense>
  );
}

/** Read from the backend on every visit, so price and stock are never out of date. */
async function Product({ params }: Pick<PageProps<"/[lang]/products/[slug]">, "params">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const product = await getProduct(slug);
  if (!product) notFound();
  const t = await getDictionary(lang);
  const image = product.images[0];

  return (
    <>
      <Header lang={lang} path={`/products/${slug}`} nav={t.nav} switchLanguage={t.switchLanguage} />
      <main className="signs min-h-svh px-6 pt-28 pb-20">
        <div className="wrap grid items-start gap-10 md:grid-cols-2">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-t-full rounded-b-2xl border border-gold/60">
            {image && <Image src={image} alt={product.name[lang]} fill preload sizes="(min-width: 768px) 448px, 100vw" className="object-cover" />}
          </div>
          <div className="md:pt-16">
            <h1 className="font-display text-4xl font-bold leading-snug">{product.name[lang]}</h1>
            <ProductBuy key={slug} product={product} lang={lang} t={t.product} />
          </div>
        </div>
      </main>
    </>
  );
}
