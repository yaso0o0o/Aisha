"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Item = { slug: string; image: string; name: string };

/** A fan of pieces in depth; the front one changes every few seconds, or by swipe and click. */
export default function Showcase({ items, lang }: { items: Item[]; lang: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const n = items.length;

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setActive((a) => (a + 1) % n), 3200);
    return () => clearInterval(timer);
  }, [paused, n]);

  return (
    <div
      className="show"
      dir="ltr"
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = startX.current === null ? 0 : e.clientX - startX.current;
        if (Math.abs(dx) > 40) setActive((a) => (a + (dx < 0 ? 1 : -1) + n) % n);
      }}
    >
      <div className="show-stage">
        {items.map((item, i) => {
          // shortest signed distance from the front card
          const offset = ((i - active + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);
          const depth = Math.abs(offset);
          return (
            <Link
              key={item.slug}
              href={`/${lang}/products/${item.slug}`}
              className="show-card"
              draggable={false}
              tabIndex={offset === 0 ? 0 : -1}
              aria-hidden={depth > 2}
              style={{
                transform: `translateX(${offset * 48}%) translateZ(${depth * -140}px) rotateY(${offset * -24}deg)`,
                opacity: depth > 2 ? 0 : 1 - depth * 0.22,
                zIndex: 10 - depth,
                pointerEvents: depth > 2 ? "none" : "auto",
              }}
              onClick={(e) => {
                // a side card comes to the front first
                if (offset !== 0) {
                  e.preventDefault();
                  setActive(i);
                }
              }}
            >
              <Image src={item.image} alt={item.name} fill sizes="260px" loading={depth > 2 ? "lazy" : "eager"} draggable={false} className="object-cover" />
            </Link>
          );
        })}
      </div>
      <p className="show-name" key={active} dir="auto">{items[active].name}</p>
    </div>
  );
}
