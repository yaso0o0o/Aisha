import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ProductSearch from "@/components/ProductSearch";
import { getDictionary, hasLocale } from "../dictionaries";

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
          <ProductSearch lang={lang} t={t.search} />
        </div>
      </main>
    </>
  );
}
