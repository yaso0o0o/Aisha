/** Price after discount, as in the spec: round(price x (1 - discount/100)). */
export const finalPrice = (price: number, discountPercent: number) =>
  Math.round(price * (1 - discountPercent / 100));
