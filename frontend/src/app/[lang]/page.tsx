import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "./dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold">{dict.title}</h1>
      <p className="text-lg">{dict.description}</p>
      <p>{dict.comingSoon}</p>
      <Link href={lang === "ar" ? "/en" : "/ar"} className="underline">
        {dict.switchLanguage}
      </Link>
    </main>
  );
}
