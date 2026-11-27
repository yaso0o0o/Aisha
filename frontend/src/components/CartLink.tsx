"use client";

import Link from "next/link";
import { useCart } from "@/data/cart";

export default function CartLink({ lang, label }: { lang: string; label: string }) {
  const count = useCart().reduce((sum, line) => sum + line.qty, 0);
  return (
    <Link href={`/${lang}/cart`} className="inline-flex items-center gap-2 hover:text-gold">
      {label}
      {count > 0 && (
        <span key={count} className="bump grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1 text-xs font-bold text-navy">
          {count}
        </span>
      )}
    </Link>
  );
}
