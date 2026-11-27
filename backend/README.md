# Aisha Gallery API

Express + TypeScript + PostgreSQL (Prisma). Full spec: `../docs/backend-spec.md`.

## Run locally
```
cd backend
npm install
cp .env.example .env
npm run db:up        # starts PostgreSQL in Docker
npm run db:migrate   # creates the tables
npm run db:seed      # fills sample products from the frontend
npm run dev
```
API on http://localhost:4000, check `GET /health`.

## Endpoints so far
| Method | Path | |
|---|---|---|
| GET | `/health` | server is up |
| GET | `/categories` | categories |
| GET | `/products?category=` | visible products |
| GET | `/products/:slug` | one product with variants and stock |
| GET | `/shipping-zones` | active zones and prices |
| GET | `/payment-methods` | what is offered, InstaPay number and name |
| POST | `/admin/login` | `{ email, password }`, sets the session cookie |
| POST | `/admin/logout` | ends the session |
| GET | `/admin/me` | the logged-in admin, or 401 |
| GET, POST | `/admin/products` | all products (hidden too), create |
| GET, PATCH, DELETE | `/admin/products/:id` | one product; PATCH needs `updatedAt`; DELETE archives a product with past orders |
| POST | `/admin/uploads` | `multipart`, field `file`, returns `{ url }` |
| GET, POST | `/admin/shipping-zones` | all zones (paused too), add |
| PATCH, DELETE | `/admin/shipping-zones/:id` | edit price/name/active, delete |
| GET, POST | `/admin/coupons` | all coupons, add (code saved in capitals) |
| PATCH, DELETE | `/admin/coupons/:id` | edit, pause, delete |
| POST | `/orders` | new order: JSON, or `multipart` with `order` (JSON) and `proof` (InstaPay screenshot) |
| GET | `/orders/:code?token=` | the customer's own order |
| GET | `/admin/orders` | `?status=` and `?transfer=awaiting` |
| PATCH | `/admin/orders/:id` | `{ status, paid }`; cancelling returns stock once |
| POST | `/admin/orders/:id/transfer` | `{ approved }`, one decision on a waiting transfer |
| GET | `/admin/orders/:id/proof` | the private transfer screenshot |
| GET, PUT | `/admin/settings/instapay` | `{ number, name }`; every change is logged |
| POST | `/coupons/check` | `{ code, subtotal }` -> `{ valid, discount }` (20 a minute per IP) |

All prices, stock and shipping prices in the seed are samples.

## Admin login
- Passwords are hashed with argon2id. Sessions last 7 days in an `HttpOnly` cookie (`Secure` in production); only a SHA-256 hash of the token is stored.
- Every `/admin` request that changes something must send `Origin` equal to `FRONTEND_ORIGIN` (CSRF protection). Browsers do this by themselves.
- 10 wrong logins per 15 minutes per IP, then 429.
- The frontend must call the API with `credentials: "include"`.
- In production set `NODE_ENV=production` and `TRUST_PROXY` to the number of proxies in front of the API.

## Product photos
- Uploads are decoded and saved again as WebP (max 1600 px, 8 MB upload limit), so only real images are kept and phone metadata (like location) is removed.
- Files are saved in `UPLOAD_DIR` and served at `/uploads/products/...`; the site forwards `/uploads` to the API.
- Photos no product uses any more are deleted.
- **Before going live:** many hosts wipe local disk on every deploy. Set `CLOUDINARY_URL` (below).

## Cloudinary
Set `CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME` (from the Cloudinary dashboard) on the host.
- Product photos go to `aisha/products` and the database keeps their https address.
- Transfer screenshots go to `aisha/proofs` as **authenticated** assets: no public address. The API downloads them with a signed link and passes them only to a logged-in admin.
- Without it, files stay in `UPLOAD_DIR`. Files already on disk are not moved over.

## Orders
- Stock check, stock taken and order saved happen in one transaction. Stock is taken with a
  conditional update (`stock >= qty`), so two customers can never get the same last piece
  (tested with 10 orders at the same moment).
- The server computes every price, discount, shipping and total. Name and price are copied into the order.
- Send the same `idempotencyKey` again and you get the first order back, not a second one.
- Cancelling (or rejecting a transfer) returns the stock exactly once; a cancelled order stays cancelled.
- The order code alone shows nothing: `GET /orders/:code` needs the long random token.
- InstaPay screenshots are saved under `UPLOAD_DIR/private`, never served publicly.
- **Open decision:** a waiting InstaPay transfer holds its stock until the owner decides. There is no time limit yet.
