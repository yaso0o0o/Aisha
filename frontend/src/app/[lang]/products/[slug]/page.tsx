import Image from "next/image";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProductBuy from "@/components/ProductBuy";
import { products } from "@/data/products";
import { getDictionary, hasLocale } from "../../dictionaries";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: PageProps<"/[lang]/products/[slug]">) {
  const { lang, slug } = await params;
  const product = products.find((p) => p.slug === slug);
  if (!hasLocale(lang) || !product) notFound();
  const t = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} path={`/products/${slug}`} nav={t.nav} switchLanguage={t.switchLanguage} />
      <main className="signs min-h-svh px-6 pt-28 pb-20">
        <div className="wrap grid items-start gap-10 md:grid-cols-2">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-t-full rounded-b-2xl border border-gold/60">
            <Image src={product.image} alt={product.name[lang]} fill preload sizes="(min-width: 768px) 448px, 100vw" className="object-cover" />
          </div>
          <div className="md:pt-16">
            <h1 className="font-display text-4xl font-bold leading-snug">{product.name[lang]}</h1>
            <ProductBuy key={slug} slug={slug} lang={lang} t={t.product} />
          </div>
        </div>
      </main>
    </>
  );
}
