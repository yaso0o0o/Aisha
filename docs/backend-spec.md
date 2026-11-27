# Aisha Gallery: اللي اتعمل واللي مطلوب من الباك

الملف ده أحدث من `backend-brief.md`، ولو فيه اختلاف يبقى الكلام اللي هنا هو الصح.

## 1. المشروع
متجر إلكتروني وداش بورد لبراند Aisha (إنستجرام: aisha.galleryy)، منتجات هاند ميد، عربي وإنجليزي، وبيشحن لبرة مصر.

- **الفرونت (ياسمين):** التصميم، المتجر، واجهة الداش بورد.
- **الباك (إنتِ):** قاعدة البيانات، الـ APIs، تسجيل الدخول، الصور، الدفع، الإشعارات، ورفع الباك.

---

## 2. اللي اتعمل في الفرونت
Next.js 16 + React + Tailwind. الكود في `frontend/`، وحاليًا على branch `feature/home-design` لحد ما يتدمج في `main`.

### المتجر
| الصفحة | المسار | فيها إيه |
|---|---|---|
| الرئيسية | `/ar` | عرض 3D للمنتجات، قسم الحكاية، التشكيلة، حيطة صور متحركة، خطوات الطلب |
| المنتجات | `/ar/products` | 35 منتج في 5 أقسام، بحث بيستحمل الأخطاء الإملائية، فلترة، علامة "خلصت" |
| صفحة المنتج | `/ar/products/[slug]` | السعر والخصم، اللون والمقاس، مدة التنفيذ، "فاضل كذا"، إضافة للسلة |
| السلة والطلب | `/ar/cart` | الكميات، بيانات العميلة، الشحن، الكوبون، طريقة الدفع، تأكيد الطلب |
| طلباتي | `/ar/orders` | حالة الطلبات اللي اتعملت من الجهاز ده |

ومعاهم: نسخة إنجليزي (`/en`)، ريسبونسيف، فوتر، وأساس Web App (تثبيته لسه متجربش على متصفح حقيقي).

### الداش بورد `/ar/admin`
عربي وإنجليزي، وفيها: المنتجات (إضافة وتعديل ومسح وإخفاء وسعر وخصم ومخزون)، تحويلات InstaPay، الطلبات، الكوبونات، أسعار الشحن.
صفحة الدخول `/ar/admin/login` **ديزاين بس**.

### مهم: كله تجريبي
- البيانات متخزنة في `localStorage` في المتصفح، فطلب عميلة من موبايلها **مش بيوصل للداش بورد**.
- مفيش حماية على `/admin`.
- الأسعار والألوان والمقاسات والمخزون وأسعار الشحن **أرقام تجريبية**.
- الصور من إنستجرام، وأسماء المنتجات من عندنا.

---

## 3. ابدئي من الملفات دي
| الملف | فيه إيه |
|---|---|
| `frontend/src/data/admin.ts` | شكل البيانات وقواعد الطلب والمخزون والكوبون. **ده أهم ملف** |
| `frontend/src/data/products.ts` | المنتجات والأقسام (تنفع seed لقاعدة البيانات) |
| `frontend/src/data/cart.ts` | السلة (هتفضل في المتصفح) |
| `frontend/src/data/store.ts` | التخزين المؤقت اللي الـ API هيحل محله |

---

## 4. قاعدة البيانات (اقتراح)
المقترح: Node.js (NestJS أو Express) + PostgreSQL + Prisma، والصور على Cloudinary. لو متمكنة من حاجة تانية قولي.

| الجدول | الأعمدة |
|---|---|
| `admins` | id, email, password_hash, created_at |
| `categories` | id, slug, name_ar, name_en, image_url, sort |
| `products` | id, slug, category_id, name_ar, name_en, price, discount_percent, made_to_order, lead_days, hidden, archived_at |
| `product_images` | id, product_id, url, sort |
| `variants` | id, product_id, color_ar, color_en, size, stock |
| `coupons` | id, code (unique), percent, min_total, valid_until, active |
| `shipping_zones` | id, name_ar, name_en, price, active |
| `orders` | id, code (unique), name, phone, address, zone_id, zone_name, payment_method, subtotal, discount, coupon_code, shipping, total, status, paid, transfer_status, proof_url, access_token, created_at |
| `order_items` | id, order_id, product_id, variant_id, name, label, unit_price, qty |
| `settings` | instapay_number, instapay_name |

**القيم:**
- `status`: `new` | `confirmed` | `shipped` | `delivered` | `cancelled`
- `payment_method`: `cod` | `instapay` | `wallet`
- `transfer_status`: `awaiting` | `approved` | `rejected` | `null`
- الأقسام الحالية: `dresses`, `abayas`, `shawls`, `bags`, `crochet`

الفلوس بالجنيه، أرقام صحيحة. في الفرونت الألوان حاليًا نصوص عربي، فالأفضل في قاعدة البيانات يبقى ليها عربي وإنجليزي زي الجدول.

---

## 5. قواعد لازم تتنفذ في السيرفر

### المنتجات والمخزون
1. المنتج ممكن يكون ليه ألوان بس، أو مقاسات بس، أو الاتنين، أو ولا حاجة. **كل منتج ليه variant واحد على الأقل.**
2. المخزون لكل variant. لو 0 يبقى "خلصت".
3. المنتج اللي بالطلب (`made_to_order`) مش بيتخصم من المخزون.
4. المنتج المخفي ميظهرش ومينفعش يتطلب.
5. مسح منتج اتطلب قبل كده = أرشفة.

### الطلب (أهم جزء)
1. كل ده في **transaction واحدة**: تتأكدي من المخزون، تخصمي، تسجلي الطلب.
2. **ممنوع عميلتين ياخدوا نفس آخر قطعة.** استخدمي خصم مشروط (`UPDATE ... SET stock = stock - n WHERE stock >= n`) أو row lock.
3. السيرفر هو اللي يحسب السعر والخصم والشحن والإجمالي. متاخديش أي رقم من الفرونت.
4. السعر بعد الخصم = `round(price × (1 − discount/100))`.
5. اسم المنتج وسعره يتحفظوا جوه الطلب وقت الشراء.
6. إلغاء الطلب يرجع المخزون **مرة واحدة بس**، والطلب الملغي ميرجعش يتفتح.
7. اعملي حماية من تكرار الطلب لو العميلة داست مرتين.

### الكوبون
الكود حروف كبيرة، ونسبة من 1 لـ 90 على المنتجات (مش الشحن). يشتغل لو: `active`، والإجمالي ≥ `min_total`، و`valid_until` فاضي أو لسه مجاش (بتوقيت القاهرة، واليوم نفسه محسوب).

### InstaPay
1. الأدمن يحدد الرقم والاسم. لو مش متحددين، الاختيار ميظهرش.
2. العميلة تشوف الرقم والاسم، وتحول، وترفع **سكرين (إجباري)**.
3. الطلب يتسجل `new` و`awaiting`، والمخزون يتحجز.
4. **موافقة:** `approved` + `paid` + `confirmed`.
5. **رفض:** `rejected` + `cancelled` والمخزون يرجع.
6. القرار مرة واحدة على الطلب المستني بس.

نقطة محتاجين نقررها: التحويل المستني يفضل حاجز المخزون لحد إمتى؟

---

## 6. الـ APIs

### المتجر (من غير تسجيل دخول)
| Method | المسار | الوظيفة |
|---|---|---|
| GET | `/categories` | الأقسام |
| GET | `/products` | المنتجات الظاهرة (`?category=`) |
| GET | `/products/:slug` | منتج بالـ variants والمخزون |
| GET | `/shipping-zones` | مناطق الشحن وأسعارها |
| GET | `/payment-methods` | المتاح، ورقم واسم InstaPay |
| POST | `/coupons/check` | `{ code, subtotal }` |
| POST | `/orders` | طلب جديد (`multipart` لو فيه سكرين) |
| GET | `/orders/:code?token=` | حالة الطلب لصاحبته بس |

### الداش بورد (كلها محمية)
| Method | المسار |
|---|---|
| POST | `/admin/login`, `/admin/logout` |
| GET | `/admin/me` |
| GET, POST | `/admin/products` |
| PATCH, DELETE | `/admin/products/:id` |
| POST | `/admin/uploads` |
| GET | `/admin/orders` (`?status=` و`?transfer=awaiting`) |
| PATCH | `/admin/orders/:id` (`status`, `paid`) |
| POST | `/admin/orders/:id/transfer` (`{ approved: true \| false }`) |
| GET | `/admin/orders/:id/proof` |
| GET, POST, PATCH, DELETE | `/admin/coupons`, `/admin/shipping-zones` |
| GET, PUT | `/admin/settings/instapay` |

البحث حاليًا في الفرونت، فمش محتاج API دلوقتي.

### أمثلة

`GET /products/dress-white`
```json
{
  "slug": "dress-white",
  "category": "dresses",
  "name": { "ar": "فستان أبيض مطرز", "en": "Embroidered white dress" },
  "images": ["https://..."],
  "price": 950,
  "discount": 0,
  "madeToOrder": false,
  "leadDays": null,
  "variants": [
    { "id": "v1", "color": { "ar": "أبيض", "en": "White" }, "size": "S", "stock": 3 }
  ]
}
```

`POST /orders`
```json
{
  "name": "…",
  "phone": "01000000000",
  "address": "…",
  "zoneId": "cairo",
  "payment": "cod",
  "coupon": "",
  "items": [{ "variantId": "v1", "qty": 1 }]
}
```
الرد:
```json
{ "code": "A1B2C3", "token": "…", "total": 1010, "status": "new", "transfer": null }
```

لو المخزون مش كفاية: `409`
```json
{ "error": "out_of_stock", "variantId": "v1", "available": 0 }
```

أخطاء المدخلات: `422` ومعاها اسم الحقل.

---

## 7. الأمان
- الباسورد hashed (argon2 أو bcrypt).
- الدخول بـ cookie `HttpOnly` و`Secure`، وحماية من CSRF.
- الحماية على السيرفر لكل `/admin`.
- حد للمحاولات على الدخول والطلبات والكوبون.
- التحقق من كل المدخلات. الملفات: صور بس، بحد أقصى للحجم.
- **سكرين التحويل خاصة**، مش على رابط عام.
- **رقم InstaPay ميتغيرش غير من أدمن مسجل دخول**، ويتسجل مين غيره وإمتى.
- كود الطلب لوحده ميكفيش لعرض الطلب، لازم `token` طويل عشوائي.
- CORS لدومين الموقع بس.
- مفيش `.env` يترفع، وحطي `.env.example` بالأسماء بس.
- مفيش بيانات كروت تتخزن.

---

## 8. غير كده
- إشعار لصاحب البراند (إيميل مثلًا) لما ييجي طلب أو تحويل.
- backup يومي لقاعدة البيانات.
- رفع الباك وقاعدة البيانات على استضافة مدفوعة باسم العميل.
- بعدين: بوابة دفع (كروت وفوري) حسب الورق المتاح.

---

## 9. ترتيب الشغل المقترح
1. مراجعة الملف ده سوا والاتفاق على شكل الـ JSON.
2. قاعدة البيانات وseed من `products.ts`.
3. تسجيل الدخول.
4. المنتجات والأقسام ورفع الصور.
5. الشحن والكوبونات.
6. الطلبات والمخزون (ومعاها تست لطلبين على آخر قطعة في نفس اللحظة).
7. InstaPay.
8. الإشعارات والرفع.

كل خطوة في branch وبعدها Pull Request. شغلك في `backend/`.

**في نفس الوقت على الفرونت:** استبدال `localStorage` بالـ APIs، وخلي صفحات المنتجات تقرا من الباك (حاليًا المنتج الجديد من الداش بورد مش بيظهر في المتجر)، وحماية صفحات الداش بورد.

---

## 10. محتاجين قرار أو معلومة
- **المحفظة الإلكترونية:** موجودة كاختيار من غير رقم يتحول عليه. تتعمل زي InstaPay ولا تتشال؟
- شركة الشحن، وهل عندها API؟
- أسعار الشحن والدول الحقيقية، والعملة للعملاء برة مصر.
- InstaPay لعملاء برة مصر غالبًا مش هينفع، فهيدفعوا إزاي؟
- سياسة الاستبدال والاسترجاع.

## تشغيل الفرونت
```
cd frontend
npm install
npm run dev
```
وبعدين http://localhost:3000/ar
