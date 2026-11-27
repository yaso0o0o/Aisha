import { notFound } from "next/navigation";
import Header from "@/components/Header";
import MyOrders from "@/components/MyOrders";
import { getDictionary, hasLocale } from "../dictionaries";

export default async function OrdersPage({ params }: PageProps<"/[lang]/orders">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} path="/orders" nav={t.nav} switchLanguage={t.switchLanguage} />
      <main className="signs min-h-svh px-6 pt-32 pb-20">
        <div className="wrap !max-w-3xl">
          <h1 className="font-display text-4xl font-bold md:text-5xl">{t.status.title}</h1>
          <MyOrders lang={lang} t={t.status} />
        </div>
      </main>
    </>
  );
}
