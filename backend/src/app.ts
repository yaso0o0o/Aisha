import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmetImport from "helmet";
import { env } from "./env.js";
import { admin } from "./routes/admin.js";
import { orders } from "./routes/orders.js";
import { store } from "./routes/store.js";
import { productsDir } from "./uploads.js";

// Vercel's type check reads helmet's CommonJS typings and rejects calling the import;
// at run time it is the same function either way.
const helmet = helmetImport as unknown as () => RequestHandler;

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet());
// Only the shop's own site may call the API from a browser.
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Uploaded product photos. File names are random and never change, so they cache for a year.
app.use(
  "/uploads/products",
  express.static(productsDir, { immutable: true, maxAge: "365d", index: false, dotfiles: "deny" }),
);

app.use(store);
app.use(orders);
app.use(admin);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
};
app.use(onError);

// Vercel runs the app from this default export; src/index.ts is for a normal server.
export default app;
