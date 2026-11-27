// Orders placed from this browser: code and the secret token needed to read each one.
import { createStore } from "./store";

export type MyOrder = { code: string; token: string };

export const myOrders = createStore<MyOrder>("aisha-my-orders-v2", []);

export function rememberOrder(order: MyOrder) {
  try {
    myOrders.write([order, ...myOrders.refresh().filter((o) => o.code !== order.code)]);
  } catch {}
}
