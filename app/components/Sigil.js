// Sigil — deterministic medieval emblem rendered from a wallet address.
//
// 12 SVG glyphs × 4 tone classes = 48 visually distinct sigils. The same
// wallet always produces the same sigil, so threads on The Board pick up
// visual identity beyond a truncated address. Pure render-time math, no
// network, no storage — just a hash of the wallet string.
//
// Usage:
//   <Sigil wallet={author} size={24} />

const GLYPHS = [
  // 0 — Sword
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M12 3 L12 17" />
      <path d="M8 17 L16 17" />
      <path d="M12 17 L12 21" />
      <path d="M10 21 L14 21" />
    </g>
  ),
  // 1 — Tower-shield
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M6 4 L18 4 L18 13 Q18 19 12 21 Q6 19 6 13 Z" />
      <path d="M12 4 L12 21" />
    </g>
  ),
  // 2 — Crown
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M4 17 L6 8 L10 13 L12 6 L14 13 L18 8 L20 17 Z" />
      <path d="M5 20 L19 20" />
    </g>
  ),
  // 3 — Holy cross
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M12 3 L12 21" />
      <path d="M6 9 L18 9" />
      <circle cx="12" cy="9" r="0.8" fill="currentColor" stroke="none" />
    </g>
  ),
  // 4 — Tree (oak)
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M12 21 L12 13" />
      <path d="M8 13 Q5 11 7 8 Q5 5 9 5 Q11 2 14 4 Q18 4 17 8 Q19 11 16 13 Z" />
    </g>
  ),
  // 5 — Scroll
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 10 L15 10" />
      <path d="M9 13 L15 13" />
      <path d="M9 16 L13 16" />
    </g>
  ),
  // 6 — Castle keep
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M5 21 L5 11 L7 11 L7 8 L9 8 L9 11 L11 11 L11 7 L13 7 L13 11 L15 11 L15 8 L17 8 L17 11 L19 11 L19 21 Z" />
    </g>
  ),
  // 7 — Crossed keys
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M9.6 9.7 L18 18" />
      <path d="M16 16 L17.5 17.5" />
      <circle cx="16" cy="8" r="2.5" />
      <path d="M14.4 9.7 L6 18" />
      <path d="M8 16 L6.5 17.5" />
    </g>
  ),
  // 8 — Crescent
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M16 4 A8 8 0 1 0 16 20 A6 6 0 1 1 16 4 Z" />
    </g>
  ),
  // 9 — Sun-rays / star of order
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3 L12 6" />
      <path d="M12 18 L12 21" />
      <path d="M3 12 L6 12" />
      <path d="M18 12 L21 12" />
      <path d="M5.6 5.6 L7.7 7.7" />
      <path d="M16.3 16.3 L18.4 18.4" />
      <path d="M5.6 18.4 L7.7 16.3" />
      <path d="M16.3 7.7 L18.4 5.6" />
    </g>
  ),
  // 10 — Chalice
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M7 5 L17 5 Q17 12 12 14 Q7 12 7 5 Z" />
      <path d="M12 14 L12 19" />
      <path d="M8 19 L16 19" />
    </g>
  ),
  // 11 — Heraldic bend
  (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M5 5 L19 5 L19 19 L5 19 Z" />
      <path d="M5 5 L19 19" />
      <path d="M5 19 L19 5" />
    </g>
  ),
];

const TONES = [
  "text-foreground",
  "text-foreground/70",
  "text-[#8a6a1f]",
  "text-[#9c3a1f]",
];

// FNV-1a over the wallet string. Simple, deterministic, zero deps.
function hashWallet(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export default function Sigil({ wallet, size = 24, className = "" }) {
  if (!wallet) {
    return (
      <span
        className={`inline-block bg-card border border-border ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }
  const h = hashWallet(wallet);
  const glyph = GLYPHS[h % GLYPHS.length];
  const tone = TONES[(h >>> 8) % TONES.length];

  return (
    <span
      className={`inline-flex items-center justify-center bg-card border border-border ${tone} ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Sigil for ${wallet.slice(0, 4)}…${wallet.slice(-4)}`}
    >
      <svg
        width={Math.round(size * 0.75)}
        height={Math.round(size * 0.75)}
        viewBox="0 0 24 24"
      >
        {glyph}
      </svg>
    </span>
  );
}
