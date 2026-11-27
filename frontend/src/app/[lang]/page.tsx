import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Showcase from "@/components/Showcase";
import Story from "@/components/Story";
import Thread from "@/components/Thread";
import Wall from "@/components/Wall";
import { categories, products } from "@/data/products";
import { getDictionary, hasLocale } from "./dictionaries";

const WHATSAPP = "https://wa.me/201281227555";
const h2 = "font-display text-4xl font-bold leading-snug md:text-6xl";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <>
      <Header lang={lang} path="" nav={t.nav} switchLanguage={t.switchLanguage} />

      <main>
        <section className="slide signs overflow-clip">
          <div className="wrap grid items-center gap-12 md:grid-cols-[1.15fr_1fr]">
            <div className="rise text-center md:text-start">
              <h1 className="font-display text-4xl font-bold leading-snug text-balance md:text-6xl md:leading-snug">
                {t.hero.headline.split(" ").map((word, i) => (
                  <span key={i}>
                    <span className="word" style={{ animationDelay: `${i * 0.12}s` }}>{word}</span>{" "}
                  </span>
                ))}
              </h1>
              <p className="mx-auto mt-6 max-w-md text-lg opacity-85 md:mx-0">{t.hero.body}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
                <a className="btn btn-solid" href="#collections">{t.hero.primary}</a>
                <a className="btn btn-line" href={WHATSAPP} target="_blank" rel="noopener noreferrer">{t.hero.secondary}</a>
              </div>
            </div>
            <div className="rise min-w-0 [animation-delay:.3s]">
              <Showcase
                lang={lang}
                items={["dress-wine", "shawl-mustard", "bag-flowers", "shawl-turquoise", "abaya-white", "crochet-cardigan", "shawl-fuchsia"].map((slug) => {
                  const p = products.find((x) => x.slug === slug)!;
                  return { slug, image: p.image, name: p.name[lang] };
                })}
              />
            </div>
          </div>
        </section>

        <Story title={t.story.title} body={t.story.body} captions={t.story.captions} />

        <section id="collections" aria-label={t.collections.title}>
          {categories.map((c, i) => (
            <div key={c.id} className={`deck slide ${i % 2 ? "bg-navy-deep" : "signs bg-navy"}`}>
              <Thread />
              <div className="wrap depth grid items-center gap-8 text-center md:grid-cols-2 md:text-start">
                <div>
                  {i === 0 && <p className="mb-3 text-lg opacity-85">{t.collections.title}</p>}
                  <h2 className={`${h2} text-gold`}>{c.name[lang]}</h2>
                  <Link className="btn btn-line mt-6" href={`/${lang}/products#${c.id}`}>{t.collections.all}</Link>
                </div>
                {(() => {
                  // the piece in the photo, so a click goes straight to buying it
                  const piece = products.find((p) => p.image === c.image)!;
                  return (
                    <Link href={`/${lang}/products/${piece.slug}`} className="shop reveal mx-auto aspect-[3/4] h-[52svh] max-w-full md:h-[72svh]">
                      <Image src={c.image} alt={piece.name[lang]} fill sizes="(min-width: 768px) 45vw, 80vw" className="object-cover" />
                    </Link>
                  );
                })()}
              </div>
            </div>
          ))}
        </section>

        <section className="slide signs flex-col justify-center overflow-clip !px-0">
          <Thread />
          <h2 className={`${h2} depth mb-10 px-6 text-center`}>{t.wall}</h2>
          <Wall items={["shawl-green", "abaya-white", "bag-hand", "shawl-fuchsia", "cardigan-orange", "bag-flowers", "shawl-purple", "dress-white", "shawl-sky", "abaya-black", "crochet-shawl-black", "poncho-maroon", "bag-clutch", "shawl-teal"].map((slug) => products.find((p) => p.slug === slug)!)} lang={lang} />
          <Link className="btn btn-solid mt-10" href={`/${lang}/products`}>{t.collections.all}</Link>
        </section>

        <section id="order" className="slide bg-wine">
          <Thread />
          <div className="wrap">
            <h2 className={h2}>{t.order.title}</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {t.order.steps.map((step, i) => (
                <li key={step.title} className="depth border-t border-gold/50 pt-6">
                  <span className="font-display text-5xl text-gold">{(i + 1).toLocaleString(lang === "ar" ? "ar-EG" : "en")}</span>
                  <h3 className="mt-3 text-2xl font-bold">{step.title}</h3>
                  <p className="mt-2 opacity-85">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="slide signs">
          <Thread />
          <div className="wrap depth text-center">
            <h2 className={h2}>{t.closing.title}</h2>
            <p className="mt-5 text-lg opacity-85">{t.closing.body}</p>
            <a className="btn btn-solid mt-8" href={WHATSAPP} target="_blank" rel="noopener noreferrer">{t.closing.cta}</a>
          </div>
        </section>
      </main>
    </>
  );
}
