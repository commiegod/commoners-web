export const metadata = {
  title: "Mid March Madness 2026 — Commoner's DAO",
  description:
    "Pick the bracket. Win the MidEvil. MidEvils holders only — up to 5 entries per wallet. Prize: MidEvil #3614 (Chadwick) transferred directly to the winner.",
  openGraph: {
    title: "Mid March Madness 2026 — Commoner's DAO",
    description:
      "Pick the bracket. Win MidEvil #3614. MidEvils holders only. Selection Sunday bracket drops March 16.",
    url: "https://commonersdao.com/bracket",
    siteName: "Commoner's DAO",
    images: [
      {
        url: "https://commonersdao.com/bracket/chadwick-shoot.png",
        width: 1200,
        height: 400,
        alt: "MidEvil #3614 Chadwick — Mid March Madness 2026",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mid March Madness 2026 — Commoner's DAO",
    description:
      "Pick the bracket. Win MidEvil #3614. MidEvils holders only.",
    images: ["https://commonersdao.com/bracket/chadwick-shoot.png"],
  },
};

export default function BracketLayout({ children }) {
  return children;
}
