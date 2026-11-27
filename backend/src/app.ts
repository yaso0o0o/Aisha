import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { env } from "./env.js";
import { store } from "./routes/store.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
// Only the shop's own site may call the API from a browser.
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(store);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
};
app.use(onError);
