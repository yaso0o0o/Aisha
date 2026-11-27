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
- **Before going live:** many hosts wipe local disk on every deploy. Move uploads to Cloudinary (or similar) or a persistent disk.
