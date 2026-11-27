import Image from "next/image";
import Thread from "./Thread";

type Props = { title: string; body: string; captions: string[] };

const shots = ["embroidery-figures", "shawl-mustard", "embroidery"];

/** Embroidery close-ups and the finished piece, drifting at different depths while scrolling. */
export default function Story({ title, body, captions }: Props) {
  return (
    <section id="story" className="slide bg-linen text-navy">
      <Thread />
      <div className="wrap grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="text-center lg:text-start">
          <h2 className="font-display text-5xl font-bold leading-snug md:text-7xl md:leading-snug">
            {title.split(" ").map((word, i) => (
              <span key={i}>
                <span className="ink">{word}</span>{" "}
              </span>
            ))}
          </h2>
          <p className="mx-auto mt-6 max-w-md text-xl leading-loose lg:mx-0">{body}</p>
        </div>
        <ul className="collage">
          {shots.map((shot, i) => (
            <li key={shot} className={`shot shot-${i + 1}`}>
              <figure>
                <div className="shot-frame">
                  <Image src={`/products/${shot}.webp`} alt={captions[i]} fill sizes="(min-width: 1024px) 280px, 45vw" className="object-cover" />
                </div>
                <figcaption className="mt-2 text-center text-sm font-bold">{captions[i]}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
