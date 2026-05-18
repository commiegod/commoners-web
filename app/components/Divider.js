// Decorative section divider — trefoil/quatrefoil sigil flanked by hairlines.
// Use between major page sections to break up rhythm without resorting to
// generic <hr>. Variants:
//   <Divider />              default trefoil
//   <Divider variant="quatrefoil" />
//   <Divider variant="cross" />
//
// Width is fluid (max-w guard at the section level if needed).

const SIGILS = {
  trefoil: (
    <g fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round">
      <circle cx="12" cy="6" r="2.6" />
      <circle cx="6" cy="14" r="2.6" />
      <circle cx="18" cy="14" r="2.6" />
      <path d="M12 8.6 L12 18" />
      <path d="M8.4 14 L15.6 14" />
    </g>
  ),
  quatrefoil: (
    <g fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round">
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="19" cy="12" r="2.4" />
      <circle cx="12" cy="19" r="2.4" />
      <circle cx="5" cy="12" r="2.4" />
      <circle cx="12" cy="12" r="1.6" />
    </g>
  ),
  cross: (
    <g fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round">
      <path d="M12 3 L12 21" />
      <path d="M5 9 L19 9" />
      <circle cx="12" cy="9" r="1.2" />
    </g>
  ),
};

export default function Divider({ variant = "trefoil", className = "" }) {
  const sigil = SIGILS[variant] || SIGILS.trefoil;
  return (
    <div
      className={`flex items-center justify-center gap-4 py-2 ${className}`}
      aria-hidden="true"
    >
      <span className="block h-px flex-1 max-w-[140px] bg-border" />
      <svg width="22" height="22" viewBox="0 0 24 24" className="text-muted/70">
        {sigil}
      </svg>
      <span className="block h-px flex-1 max-w-[140px] bg-border" />
    </div>
  );
}
