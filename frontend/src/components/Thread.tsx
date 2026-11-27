/** The gold thread that is "sewn" between slides while scrolling. */
export default function Thread() {
  return (
    <svg
      className="thread pointer-events-none absolute inset-x-0 top-0 h-24 w-full -translate-y-1/2 text-gold"
      viewBox="0 0 1200 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        pathLength={1}
        d="M-10 60 C 200 10, 330 95, 520 55 S 650 0, 610 40 S 700 100, 880 50 S 1100 20, 1210 55"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  );
}
