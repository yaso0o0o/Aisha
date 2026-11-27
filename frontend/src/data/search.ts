// Forgiving search: spelling, dots, hamza, singular/plural and small typos.

/** Folds the letters people usually swap, in Arabic and English. */
const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئى]/g, "ي")
    .replace(/ء/g, "")
    .replace(/ة/g, "ه")
    .replace(/ث/g, "ت")
    .replace(/ذ/g, "د")
    .replace(/ظ/g, "ض")
    .replace(/(.)\1+/g, "$1");

// Words that mean the same thing; the first one stands for the group.
const groups = [
  "شال شيلان شالات طرحه طرح كوفيه سكارف اسكارف shawl shawls scarf",
  "شنطه شنط شنطات شناط حقيبه حقايب كلاتش محفظه بوك bag bags clutch pouch tote handbag",
  "فستان فساتين دريس تونيك dress dresses tunic",
  "عبايه عبايات عبايا عباءه كارديجان كارديغان كاردجن بونشو abaya abayas cardigan cardigans poncho",
  "كروشيه كروشي تريكو crochet",
  "مطرز مطرزه تطريز embroidered embroidery",
  "ابيض بيضا بيضه white",
  "اسود سودا سوده black",
  "احمر حمرا حمره red",
  "اخضر خضرا خضره green",
  "ازرق زرقا زرقه blue",
  "اصفر صفرا صفره yellow",
  "رمادي رصاصي grey gray",
  "نبيتي عنابي نبيدي maroon wine",
  "بينك روز وردي بمبي pink fuchsia فوشيا",
  "بنفسجي موف purple",
  "برتقالي اورانج orange",
  "لبني سماوي sky",
  "كحلي navy",
].map((group) => group.split(" ").map(fold));

const synonyms = new Map(groups.flatMap((g) => g.map((word) => [word, g[0]] as const)));
const members = new Map(groups.map((g) => [g[0], g] as const));

/** Splits into words, drops "ال"/"و" prefixes and maps synonyms to one form. */
export function tokens(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => {
      const bare = word.replace(/^(وال|ال)(?=..)/, "");
      return synonyms.get(word) ?? synonyms.get(bare) ?? bare;
    });
}

/** Edit distance where swapping two neighbouring letters counts as one typo. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** 0 = exact or beginning of a word, 1+ = typos, Infinity = no match. */
function wordScore(query: string, word: string): number {
  if (word.startsWith(query) || (query.length > 2 && word.includes(query))) return 0;
  const allowed = query.length >= 6 ? 2 : query.length >= 3 ? 1 : 0;
  if (!allowed) return Infinity;
  // also compare with the start of the word, for typos while still typing
  const best = Math.min(
    distance(query, word),
    query.length >= 4 ? distance(query, word.slice(0, query.length)) : Infinity,
  );
  return best <= allowed ? best : Infinity;
}

/**
 * Items matching every query word. Typo matches are only used
 * when nothing matches that word as written.
 */
export function search<T>(items: T[], query: string, text: (item: T) => string): T[] {
  const asked = tokens(query);
  let found = items.map((item) => ({ item, words: tokens(text(item)).flatMap((w) => members.get(w) ?? [w]) }));
  for (const q of asked) {
    // try the synonym form, and the raw word for half-typed input
    const scored = found.map((f) => ({ f, score: Math.min(...f.words.map((w) => wordScore(q, w))) }));
    const best = Math.min(...scored.map((s) => s.score));
    found = best === Infinity ? [] : scored.filter((s) => s.score === best).map((s) => s.f);
  }
  return found.map((f) => f.item);
}
