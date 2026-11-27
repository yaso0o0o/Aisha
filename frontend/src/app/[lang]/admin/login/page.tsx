import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { hasLocale } from "../../dictionaries";

export const metadata: Metadata = { title: "Aisha Dashboard", robots: { index: false, follow: false } };

const words = {
  ar: { title: "أهلًا بيكي", body: "سجلي دخول علشان تديري متجرك.", other: "English", email: "الإيميل", password: "الباسورد", show: "إظهار", hide: "إخفاء", submit: "تسجيل الدخول", missing: "اكتبي إيميل صحيح والباسورد.", pending: "تسجيل الدخول لسه مش متوصل بالباك.", demo: "ادخلي النسخة التجريبية" },
  en: { title: "Welcome back", body: "Sign in to manage your store.", other: "العربية", email: "Email", password: "Password", show: "Show", hide: "Hide", submit: "Sign in", missing: "Enter a valid email and your password.", pending: "Sign-in is not connected to the backend yet.", demo: "Open the demo dashboard" },
};

export default async function LoginPage({ params }: PageProps<"/[lang]/admin/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = words[lang];

  return (
    <main className="admin signs grid min-h-svh place-items-center px-5 py-12">
      <div className="rise w-full max-w-md rounded-t-[12rem] rounded-b-3xl border border-gold/60 bg-navy-deep/90 px-7 pt-14 pb-8 text-center shadow-2xl">
        <Image src="/brand/logo.webp" alt="Aisha" width={156} height={104} className="mx-auto" loading="eager" />
        <h1 className="mt-5 font-display text-4xl font-bold">{t.title}</h1>
        <p className="mt-2 opacity-80">{t.body}</p>
        <LoginForm key={lang} lang={lang} t={t} />
        <Link className="mt-4 inline-block min-h-11 text-gold underline" href={`/${lang === "ar" ? "en" : "ar"}/admin/login`}>{t.other}</Link>
      </div>
    </main>
  );
}
