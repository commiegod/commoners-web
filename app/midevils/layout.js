export const metadata = {
  title: "MidEvils Scrolls — Commoner's DAO",
  description:
    "They're only half evil. The MidEvils community pulse — memes shared, tweets that hit, weeks that went off.",
  openGraph: {
    title: "MidEvils Scrolls",
    description:
      "They're only half evil. The MidEvils community pulse — memes shared, tweets that hit, weeks that went off.",
    url: "https://commonersdao.com/midevils",
    siteName: "Commoner's DAO",
    images: [{ url: "/scrolls-banner.jpg", width: 1400, height: 210 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MidEvils Scrolls",
    description:
      "They're only half evil. The MidEvils community pulse — memes shared, tweets that hit, weeks that went off.",
    images: ["/scrolls-banner.jpg"],
  },
};

export default function MidevilsLayout({ children }) {
  return children;
}
