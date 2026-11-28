import type { StatusLabels } from "./OrderStatus";

const steps = {
  new: "stepNew",
  confirmed: "stepConfirmed",
  shipped: "stepShipped",
  delivered: "stepDelivered",
  cancelled: "stepCancelled",
  approved: "stepApproved",
  rejected: "stepRejected",
} as const;

/** Every change of the order with its time, newest last. */
export default function OrderHistory({ history, lang, t }: { history: { kind: string; at: string }[]; lang: "ar" | "en"; t: StatusLabels }) {
  if (!history.length) return null;
  const when = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });

  return (
    <div className="mt-4">
      <h3 className="font-bold">{t.history}</h3>
      <ol className="mt-3 border-s-2 border-gold/50 ps-5">
        {history.map((h, i) => (
          <li key={`${h.kind}-${h.at}`} className="relative pb-4 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute -start-[1.72rem] top-1.5 h-3 w-3 rounded-full border-2 border-gold ${i === history.length - 1 ? "bg-gold" : "bg-navy-deep"}`}
            />
            <p className={i === history.length - 1 ? "font-bold text-gold" : ""}>{t[steps[h.kind as keyof typeof steps]] ?? h.kind}</p>
            <time dateTime={h.at} className="text-sm opacity-70">{when.format(new Date(h.at))}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}
