// Customer order endpoints (no login): place an order, and follow it with its token.
import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { MulterError } from "multer";
import { z } from "zod";
import { env } from "../env.js";
import { OrderError, findOrderForCustomer, placeOrder, publicOrder } from "../orders.js";
import { NotAnImage, orderForm, removeProof, saveProof } from "../uploads.js";
import { invalid } from "../validate.js";

export const orders = Router();

// A real customer places a few orders at most; this stops floods of fake ones.
const orderLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Tests place many orders from one address; everywhere else the real limit applies.
  limit: env.NODE_ENV === "test" ? 10_000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

/** Arabic digits to Latin, spaces and dashes removed. */
const normalizePhone = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[\s-]/g, "");

const orderBody = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^\+?\d{10,15}$/)),
  address: z.string().trim().min(5).max(500),
  zoneId: z.string().trim().min(1).max(40),
  payment: z.enum(["cod", "instapay", "wallet"]),
  coupon: z.string().trim().max(30).default(""),
  items: z
    .array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(20) }))
    .min(1)
    .max(50),
  idempotencyKey: z.string().regex(/^[\w-]{16,64}$/).optional(),
});

/** JSON body, or multipart with the order in an "order" field and the screenshot in "proof". */
function readOrderForm(req: Request, res: Response, next: NextFunction) {
  if (!req.is("multipart/form-data")) return next();
  orderForm(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(tooBig ? 413 : 422).json({ error: tooBig ? "too_large" : "bad_upload", field: "proof" });
    }
    if (err) return next(err);
    try {
      req.body = JSON.parse(String(req.body?.order ?? ""));
    } catch {
      return res.status(422).json({ error: "invalid", field: "order" });
    }
    next();
  });
}

orders.post("/orders", orderLimit, readOrderForm, async (req, res) => {
  const body = orderBody.safeParse(req.body);
  if (!body.success) return invalid(res, body.error);

  let proof: string | undefined;
  if (body.data.payment === "instapay" && req.file) {
    try {
      proof = await saveProof(req.file.buffer);
    } catch (e) {
      if (e instanceof NotAnImage) return res.status(422).json({ error: "not_an_image", field: "proof" });
      throw e;
    }
  }

  try {
    const order = await placeOrder({ ...body.data, proof });
    // A repeated request returns the first order; drop the screenshot sent again.
    if (proof && order.proofUrl !== proof) await removeProof(proof);
    res.status(201).json({ ...publicOrder(order), token: order.accessToken });
  } catch (e) {
    if (proof) await removeProof(proof);
    if (e instanceof OrderError) return res.status(e.status).json(e.body);
    throw e;
  }
});

orders.get("/orders/:code", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const order = token && (await findOrderForCustomer(req.params.code, token));
  // Same answer for a wrong code and a wrong token.
  if (!order) return res.status(404).json({ error: "not_found" });
  res.set("Cache-Control", "no-store");
  res.json(publicOrder(order));
});
