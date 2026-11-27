import { notFound } from "next/navigation";
import CartView from "@/components/CartView";
import Header from "@/components/Header";
import { getDictionary, hasLocale } from "../dictionaries";

export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} path="/cart" nav={t.nav} switchLanguage={t.switchLanguage} />
      <main className="signs min-h-svh px-6 pt-32 pb-20">
        <div className="wrap !max-w-3xl">
          <h1 className="font-display text-4xl font-bold md:text-5xl">{t.cart.title}</h1>
          <CartView lang={lang} t={{ ...t.cart, color: t.product.color, size: t.product.size }} checkout={t.checkout} status={t.status} />
        </div>
      </main>
    </>
  );
}
