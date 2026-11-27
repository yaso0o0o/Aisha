import Image from "next/image";
import Link from "next/link";
import CartLink from "./CartLink";

type Props = {
  lang: "ar" | "en";
  /** Path after the language, used by the language switch. */
  path: string;
  nav: { story: string; products: string; order: string; cart: string; search: string };
  switchLanguage: string;
};

export default function Header({ lang, path, nav, switchLanguage }: Props) {
  return (
    <header className="absolute inset-x-0 top-0 z-10 px-6 py-4">
      <nav className="wrap flex items-center justify-between gap-4">
        <Link href={`/${lang}`}>
          <Image src="/brand/logo.webp" alt="Aisha" width={84} height={56} loading="eager" />
        </Link>
        <div className="flex items-center gap-4 text-sm md:gap-6">
          <Link className="hidden hover:text-gold md:inline" href={`/${lang}#story`}>{nav.story}</Link>
          <Link className="hover:text-gold" href={`/${lang}/products`}>{nav.products}</Link>
          <Link className="hidden hover:text-gold md:inline" href={`/${lang}#order`}>{nav.order}</Link>
          <Link className="grid h-11 w-8 place-items-center hover:text-gold" href={`/${lang}/products#search`} aria-label={nav.search}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </Link>
          <CartLink lang={lang} label={nav.cart} />
          <Link className="btn btn-line" href={`/${lang === "ar" ? "en" : "ar"}${path}`}>{switchLanguage}</Link>
        </div>
      </nav>
    </header>
  );
}
