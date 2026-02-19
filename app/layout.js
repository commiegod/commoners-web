import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "./components/Nav";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "The Commoner's SubDAO",
  description: "Daily auctions for 3-trait MidEvils",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <Providers>
          <Nav />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-border py-8 mt-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-muted text-sm">
              The Commoner&apos;s SubDAO &middot; 3-Trait MidEvils
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
