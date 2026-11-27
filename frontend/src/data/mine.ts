// Numbers of the orders placed from this browser.
import { createStore } from "./store";

export const myOrderIds = createStore<string>("aisha-my-orders", []);

export function rememberOrder(id: string) {
  try {
    myOrderIds.write([id, ...myOrderIds.refresh()]);
  } catch {}
}
