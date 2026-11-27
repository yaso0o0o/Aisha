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

All prices, stock and shipping prices in the seed are samples.
