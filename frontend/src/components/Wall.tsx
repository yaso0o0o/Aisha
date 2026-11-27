import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/data/products";

/** Two rows of pieces gliding past each other. The second copy only makes the loop seamless. */
export default function Wall({ items, lang }: { items: Product[]; lang: "ar" | "en" }) {
  const half = Math.ceil(items.length / 2);
  return (
    <div className="wall" dir="ltr">
      {[items.slice(0, half), items.slice(half)].map((row, r) => (
        <div key={r} className={r ? "wall-row wall-back" : "wall-row"}>
          {[0, 1].map((copy) => (
            <ul key={copy} className="wall-set" aria-hidden={copy === 1}>
              {row.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${lang}/products/${p.slug}`} className="wall-card" tabIndex={copy ? -1 : undefined}>
                    <Image src={p.image} alt={p.name[lang]} fill sizes="240px" loading="eager" fetchPriority="low" className="object-cover" />
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      ))}
    </div>
  );
}
