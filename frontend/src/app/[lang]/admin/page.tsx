import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSession from "@/components/admin/AdminSession";
import { AdminLang } from "@/components/admin/lang";
import Tabs from "@/components/admin/Tabs";
import { hasLocale } from "../dictionaries";

export const metadata: Metadata = { title: "Aisha Dashboard", robots: { index: false, follow: false } };

const words = {
  ar: { title: "داش بورد Aisha", shop: "رجوع للمتجر", other: "English", demo: "كل حاجة هنا بتتحفظ على السيرفر. الأسعار والمخزون وأسعار الشحن لسه أرقام تجريبية لحد ما تحطي الحقيقية." },
  en: { title: "Aisha Dashboard", shop: "Back to the shop", other: "العربية", demo: "Everything here is saved on the server. Prices, stock and shipping prices are still sample numbers until you enter the real ones." },
};

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = words[lang];

  return (
    <main className="admin min-h-svh bg-linen px-4 pb-16 text-navy">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-5">
        <h1 className="font-display text-3xl font-bold">{t.title}</h1>
        <nav className="flex flex-wrap items-center gap-4">
          <Link className="underline" href={`/${lang}`}>{t.shop}</Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-navy/30 px-5 font-bold" href={`/${lang === "ar" ? "en" : "ar"}/admin`}>{t.other}</Link>
        </nav>
      </header>
      <p className="mx-auto mb-6 max-w-5xl rounded-lg border border-wine/40 bg-wine/10 p-3 text-sm font-bold">{t.demo}</p>
      <AdminLang key={lang} lang={lang}>
        <AdminSession>
          <Tabs />
        </AdminSession>
      </AdminLang>
    </main>
  );
}
