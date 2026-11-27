import Image from "next/image";
import Link from "next/link";

type Props = {
  lang: "ar" | "en";
  nav: { products: string; cart: string; orders: string };
  t: { about: string; whatsapp: string; instagram: string; rights: string };
};

const link = "inline-flex min-h-11 items-center hover:text-gold";
const external = { target: "_blank", rel: "noopener noreferrer" };

export default function Footer({ lang, nav, t }: Props) {
  return (
    <footer className="snap-end border-t border-gold/40 bg-navy-deep px-6 py-10">
      <div className="wrap flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-start">
        <div>
          <Image src="/brand/logo.webp" alt="Aisha" width={105} height={70} className="mx-auto md:mx-0" />
          <p className="mt-3 max-w-xs opacity-80">{t.about}</p>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-6">
          <Link className={link} href={`/${lang}/products`}>{nav.products}</Link>
          <Link className={link} href={`/${lang}/cart`}>{nav.cart}</Link>
          <Link className={link} href={`/${lang}/orders`}>{nav.orders}</Link>
          <a className={link} href="https://wa.me/201281227555" {...external}>{t.whatsapp}</a>
          <a className={link} href="https://www.instagram.com/aisha.galleryy/" {...external}>{t.instagram}</a>
        </nav>
      </div>
      <p className="wrap mt-8 border-t border-gold/20 pt-6 text-center text-sm opacity-85">
        © 2026{" "}
        <a className="font-bold text-gold underline" href="https://www.instagram.com/par.adgm" {...external}>
          Paradigm
        </a>
        . {t.rights}
      </p>
    </footer>
  );
}
