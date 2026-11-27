// Temporary data until the API is ready. Photos are from the brand's Instagram.
// Colours, sizes and lead times are SAMPLES; prices are SAMPLES too (EGP) until the owner edits them.

type Text = { ar: string; en: string };

export type Product = {
  slug: string;
  category: CategoryId;
  image: string;
  name: Text;
  colors?: Text[];
  sizes?: string[];
  madeToOrderDays?: number;
  price: number;
};

export const categories = [
  { id: "dresses", image: "/products/dress-wine.webp", name: { ar: "فساتين مطرزة", en: "Embroidered dresses" } },
  { id: "abayas", image: "/products/abaya-white.webp", name: { ar: "عبايات وكارديجان", en: "Abayas and cardigans" } },
  { id: "shawls", image: "/products/shawl-mustard.webp", name: { ar: "شيلان", en: "Shawls" } },
  { id: "bags", image: "/products/bag-flowers.webp", name: { ar: "شنط", en: "Bags" } },
  { id: "crochet", image: "/products/crochet-cardigan.webp", name: { ar: "كروشيه", en: "Crochet" } },
] as const;

export type CategoryId = (typeof categories)[number]["id"];

const wine = { ar: "نبيتي", en: "Wine" };
const white = { ar: "أبيض", en: "White" };
const sizes = ["S", "M", "L", "XL"];

// Sample price per category, with exceptions below.
const categoryPrice: Record<CategoryId, number> = { dresses: 950, abayas: 1100, shawls: 650, bags: 450, crochet: 800 };
const ownPrice: Record<string, number> = {
  "crochet-cardigan": 1600,
  "abaya-white": 1250,
  "abaya-black": 1350,
  "poncho-maroon": 900,
  "poncho-black": 900,
  "dress-navy": 850,
  "bag-tote": 600,
  "bag-pouch": 300,
  "bag-clutch": 400,
  "shawl-blue": 450,
  "shawl-multi": 750,
};

/** Egyptian pounds, written for the page language. */
export const formatPrice = (value: number, lang: "ar" | "en") =>
  new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(value);

const list: Omit<Product, "price">[] = [
  { slug: "dress-wine", category: "dresses", image: "/products/dress-wine.webp", name: { ar: "فستان نبيتي مطرز", en: "Embroidered wine dress" }, sizes },
  { slug: "dress-white", category: "dresses", image: "/products/dress-white.webp", name: { ar: "فستان أبيض مطرز", en: "Embroidered white dress" }, sizes, colors: [white, wine] },
  { slug: "shawl-mustard", category: "shawls", image: "/products/shawl-mustard.webp", name: { ar: "شال مسطردة مطرز", en: "Embroidered mustard shawl" } },
  { slug: "shawl-white", category: "shawls", image: "/products/shawl-white.webp", name: { ar: "شال أبيض مطرز", en: "Embroidered white shawl" } },
  { slug: "shawl-blue", category: "shawls", image: "/products/shawl-blue.webp", name: { ar: "كوفية زرقا", en: "Blue scarf" }, colors: [{ ar: "أزرق", en: "Blue" }, wine] },
  { slug: "crochet-bag", category: "bags", image: "/products/crochet-bag.webp", name: { ar: "شنطة كروشيه", en: "Crochet bag" } },
  { slug: "crochet-cardigan", category: "crochet", image: "/products/crochet-cardigan.webp", name: { ar: "جاكيت كروشيه طويل", en: "Long crochet cardigan" }, sizes, madeToOrderDays: 14 },
  { slug: "shawl-turquoise", category: "shawls", image: "/products/shawl-turquoise.webp", name: { ar: "شال تركواز مطرز", en: "Embroidered turquoise shawl" } },
  { slug: "shawl-teal", category: "shawls", image: "/products/shawl-teal.webp", name: { ar: "شال بترولي مطرز", en: "Embroidered teal shawl" } },
  { slug: "shawl-pink", category: "shawls", image: "/products/shawl-pink.webp", name: { ar: "شال بينك مطرز", en: "Embroidered pink shawl" } },
  { slug: "shawl-scenes", category: "shawls", image: "/products/shawl-scenes.webp", name: { ar: "شال أبيض برسومات", en: "White story shawl" } },
  { slug: "bag-flowers", category: "bags", image: "/products/bag-flowers.webp", name: { ar: "شنطة كروشيه ورد", en: "Flower crochet bag" } },
  { slug: "bag-clutch", category: "bags", image: "/products/bag-clutch.webp", name: { ar: "كلاتش بشراشيب", en: "Fringed clutch" } },
  { slug: "crochet-shawl-black", category: "crochet", image: "/products/crochet-shawl-black.webp", name: { ar: "شال كروشيه ورد", en: "Flower crochet shawl" } },
  { slug: "abaya-white", category: "abayas", image: "/products/abaya-white.webp", name: { ar: "عباية بيضا مطرزة", en: "Embroidered white abaya" } },
  { slug: "abaya-black", category: "abayas", image: "/products/abaya-black.webp", name: { ar: "عباية سودا شفافة مطرزة", en: "Sheer black embroidered abaya" } },
  { slug: "cardigan-cream", category: "abayas", image: "/products/cardigan-cream.webp", name: { ar: "كارديجان كريمي مطرز", en: "Embroidered cream cardigan" } },
  { slug: "cardigan-yellow", category: "abayas", image: "/products/cardigan-yellow.webp", name: { ar: "كارديجان أصفر مطرز", en: "Embroidered yellow cardigan" } },
  { slug: "cardigan-orange", category: "abayas", image: "/products/cardigan-orange.webp", name: { ar: "كارديجان برتقالي مطرز", en: "Embroidered orange cardigan" } },
  { slug: "poncho-maroon", category: "abayas", image: "/products/poncho-maroon.webp", name: { ar: "بونشو عنابي", en: "Maroon poncho" } },
  { slug: "poncho-black", category: "abayas", image: "/products/poncho-black.webp", name: { ar: "بونشو أسود", en: "Black poncho" } },
  { slug: "dress-grey", category: "dresses", image: "/products/dress-grey.webp", name: { ar: "فستان رمادي مطرز", en: "Embroidered grey dress" } },
  { slug: "dress-navy", category: "dresses", image: "/products/dress-navy.webp", name: { ar: "تونيك كحلي مطرز", en: "Embroidered navy tunic" } },
  { slug: "shawl-green", category: "shawls", image: "/products/shawl-green.webp", name: { ar: "شال أخضر مطرز", en: "Embroidered green shawl" } },
  { slug: "shawl-maroon", category: "shawls", image: "/products/shawl-maroon.webp", name: { ar: "شال عنابي مطرز", en: "Embroidered maroon shawl" } },
  { slug: "shawl-fuchsia", category: "shawls", image: "/products/shawl-fuchsia.webp", name: { ar: "شال فوشيا مطرز", en: "Embroidered fuchsia shawl" } },
  { slug: "shawl-purple", category: "shawls", image: "/products/shawl-purple.webp", name: { ar: "شال بنفسجي مطرز", en: "Embroidered purple shawl" } },
  { slug: "shawl-orange", category: "shawls", image: "/products/shawl-orange.webp", name: { ar: "شال برتقالي مطرز", en: "Embroidered orange shawl" } },
  { slug: "shawl-sky", category: "shawls", image: "/products/shawl-sky.webp", name: { ar: "شال لبني مطرز", en: "Embroidered sky blue shawl" } },
  { slug: "shawl-grey", category: "shawls", image: "/products/shawl-grey.webp", name: { ar: "شال رمادي مطرز", en: "Embroidered grey shawl" } },
  { slug: "shawl-multi", category: "shawls", image: "/products/shawl-multi.webp", name: { ar: "شال ملون", en: "Multicolour shawl" } },
  { slug: "bag-green", category: "bags", image: "/products/bag-green.webp", name: { ar: "شنطة كروس خضرا", en: "Green crossbody bag" } },
  { slug: "bag-hand", category: "bags", image: "/products/bag-hand.webp", name: { ar: "شنطة يد مطرزة", en: "Embroidered handbag" } },
  { slug: "bag-pouch", category: "bags", image: "/products/bag-pouch.webp", name: { ar: "كلاتش مطرز", en: "Embroidered pouch" } },
  { slug: "bag-tote", category: "bags", image: "/products/bag-tote.webp", name: { ar: "شنطة كتف كبيرة", en: "Large tote bag" } },
];

export const products: Product[] = list.map((p) => ({ ...p, price: ownPrice[p.slug] ?? categoryPrice[p.category] }));
