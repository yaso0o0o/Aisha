# Aisha Gallery

Online store and admin dashboard for handmade products.

## Structure
- `frontend/` - store and dashboard (Next.js + Tailwind)
- `backend/` - API
- `docs/` - database design and API list

## Run the frontend
```
cd frontend
npm install
npm run dev
```
Open http://localhost:3000

The site forwards `/api/*` to the backend at `API_URL` (default `http://localhost:4000`, see `frontend/.env.example`). To use the dashboard, run the backend too (`backend/README.md`) and create an admin with `npm run admin:create`.

## Workflow
One branch per feature (e.g. `feature/products-page`), then a Pull Request into `main`.
Never commit passwords or `.env` files.
