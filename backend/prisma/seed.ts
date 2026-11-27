// Fills the database with the frontend's sample products, categories and shipping zones.
// Safe to run again: it updates what exists instead of duplicating.
// Prices, colours, sizes, stock and shipping prices are SAMPLES until the owner edits them.
import { PrismaClient } from "@prisma/client";
import { categories, products } from "../../frontend/src/data/products.js";

const prisma = new PrismaClient();

const SAMPLE_STOCK = 3;

const zones = [
  { id: "cairo", nameAr: "القاهرة والجيزة", nameEn: "Cairo and Giza", price: 60 },
  { id: "alex", nameAr: "الإسكندرية", nameEn: "Alexandria", price: 75 },
  { id: "egypt", nameAr: "باقي المحافظات", nameEn: "Other governorates", price: 100 },
  { id: "world", nameAr: "خارج مصر", nameEn: "Outside Egypt", price: 900 },
];

async function main() {
  for (const [sort, c] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: c.id },
      create: { slug: c.id, nameAr: c.name.ar, nameEn: c.name.en, imageUrl: c.image, sort },
      update: { nameAr: c.name.ar, nameEn: c.name.en, imageUrl: c.image, sort },
    });
  }
  const categoryIds = new Map(
    (await prisma.category.findMany()).map((c) => [c.slug, c.id]),
  );

  for (const p of products) {
    const data = {
      categoryId: categoryIds.get(p.category)!,
      nameAr: p.name.ar,
      nameEn: p.name.en,
      price: p.price,
      madeToOrder: Boolean(p.madeToOrderDays),
      leadDays: p.madeToOrderDays ?? null,
    };
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...data },
      update: data,
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({ data: { productId: product.id, url: p.image, sort: 0 } });

    // Every colour x size combination; a product with neither still gets one variant.
    const colors = p.colors?.length ? p.colors : [{ ar: "", en: "" }];
    const sizes = p.sizes?.length ? p.sizes : [""];
    for (const color of colors) {
      for (const size of sizes) {
        await prisma.variant.upsert({
          where: { productId_colorEn_size: { productId: product.id, colorEn: color.en, size } },
          create: {
            productId: product.id,
            colorAr: color.ar,
            colorEn: color.en,
            size,
            stock: data.madeToOrder ? 0 : SAMPLE_STOCK,
          },
          update: { colorAr: color.ar },
        });
      }
    }
  }

  for (const [sort, z] of zones.entries()) {
    await prisma.shippingZone.upsert({ where: { id: z.id }, create: { ...z, sort }, update: {} });
  }

  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const counts = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    variants: await prisma.variant.count(),
    zones: await prisma.shippingZone.count(),
  };
  console.log("Seeded", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
