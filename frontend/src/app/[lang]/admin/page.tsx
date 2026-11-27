import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminLang } from "@/components/admin/lang";
import Tabs from "@/components/admin/Tabs";
import { hasLocale } from "../dictionaries";

export const metadata: Metadata = { title: "Aisha Dashboard", robots: { index: false, follow: false } };

const words = {
  ar: { title: "داش بورد Aisha", shop: "رجوع للمتجر", login: "صفحة تسجيل الدخول", other: "English", demo: "نسخة تجريبية: التعديلات بتتحفظ على المتصفح ده بس، والمتجر على نفس المتصفح بيقرا منها السعر والمخزون، والمنتج الجديد مش بيظهر فيه لحد ما نربط الباك. ولسه مفيش حماية بتسجيل دخول." },
  en: { title: "Aisha Dashboard", shop: "Back to the shop", login: "Sign-in page", other: "العربية", demo: "Demo version: changes are saved in this browser only. The shop in this browser reads price and stock from here, and a new product will not appear there until the backend is connected. Sign-in does not protect this page yet." },
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
          <Link className="underline" href={`/${lang}/admin/login`}>{t.login}</Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-navy/30 px-5 font-bold" href={`/${lang === "ar" ? "en" : "ar"}/admin`}>{t.other}</Link>
        </nav>
      </header>
      <p className="mx-auto mb-6 max-w-5xl rounded-lg border border-wine/40 bg-wine/10 p-3 text-sm font-bold">{t.demo}</p>
      <AdminLang key={lang} lang={lang}>
        <Tabs />
      </AdminLang>
    </main>
  );
}
