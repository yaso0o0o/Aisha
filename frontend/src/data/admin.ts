// Order and payment names shown in the shop and the dashboard.

export const orderStatuses = {
  new: "جديد",
  confirmed: "متأكد",
  shipped: "اتشحن",
  delivered: "اتسلم",
  cancelled: "ملغي",
} as const;

export const orderStatusesEn: Record<keyof typeof orderStatuses, string> = {
  new: "New",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const payments = { cod: "كاش عند الاستلام", instapay: "InstaPay", wallet: "محفظة" } as const;

export const paymentsEn: Record<keyof typeof payments, string> = { cod: "Cash on delivery", instapay: "InstaPay", wallet: "Wallet" };
