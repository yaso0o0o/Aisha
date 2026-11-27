import type { Metadata, Viewport } from "next";
import { Cairo, El_Messiri } from "next/font/google";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import ServiceWorker from "@/components/ServiceWorker";
import { getDictionary, hasLocale, locales } from "./dictionaries";
import "./globals.css";

const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"] });
const messiri = El_Messiri({ variable: "--font-messiri", subsets: ["arabic", "latin"] });

export const viewport: Viewport = { themeColor: "#18163e" };

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return { title: dict.title, description: dict.description };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const t = await getDictionary(lang);

  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`${cairo.variable} ${messiri.variable} antialiased`}
      data-scroll-behavior="smooth"
    >
      <body>
        {children}
        <Footer lang={lang} nav={t.nav} t={t.footer} />
        <ServiceWorker />
      </body>
    </html>
  );
}
