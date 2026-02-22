import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";
import { Providers } from "./providers";
import ErrorBoundary from "./components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Commoner's DAO",
  description: "Daily NFT auctions run by 3-trait MidEvil holders.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Commoner's DAO",
    description: "Daily NFT auctions run by 3-trait MidEvil holders.",
    url: "https://commonersdao.com",
    siteName: "Commoner's DAO",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Commoner's DAO",
    description: "Daily NFT auctions run by 3-trait MidEvil holders.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <Providers>
          <ErrorBoundary>
          <Nav />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-border py-8 mt-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <img
                  src="/icon.png"
                  alt=""
                  className="h-10 w-auto"
                                  />
                <img src="/wordmark.png" alt="Commoner's DAO" className="h-7 w-auto" style={{ mixBlendMode: "multiply" }} />
              </div>
              <p className="text-muted text-xs">3-Trait MidEvils · Daily Auctions</p>
            </div>
          </footer>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
