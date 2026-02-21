"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (m) => m.WalletMultiButton
    ),
  { ssr: false }
);

const links = [
  { href: "/gallery", label: "Gallery" },
  { href: "/bounty", label: "Bounty" },
  { href: "/holders", label: "Holders" },
  { href: "/treasury", label: "Treasury" },
  { href: "/governance", label: "Governance" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2">
          <img
            src="/icon.png"
            alt=""
            className="h-9 w-auto"
            style={{ mixBlendMode: "multiply" }}
          />
          <img src="/wordmark.png" alt="Commoner's DAO" className="h-6 w-auto" style={{ mixBlendMode: "multiply" }} />
        </Link>

        {/* Desktop links + wallet */}
        <div className="hidden sm:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-gold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <WalletMultiButton
            style={{
              backgroundColor: "transparent",
              border: "1px solid #1a1a1a",
              color: "#1a1a1a",
              fontSize: "0.75rem",
              borderRadius: 0,
              height: "auto",
              padding: "0.375rem 0.75rem",
              lineHeight: 1.5,
            }}
          />
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-muted hover:text-foreground p-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile full-screen overlay */}
      <div
        className={`sm:hidden fixed inset-0 z-50 bg-background flex flex-col transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
            <img
              src="/icon.png"
              alt=""
              className="h-9 w-auto"
              style={{ mixBlendMode: "multiply" }}
            />
            <img src="/wordmark.png" alt="Commoner's DAO" className="h-6 w-auto" style={{ mixBlendMode: "multiply" }} />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-muted hover:text-foreground transition-colors"
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Links — large, centered */}
        <div className="flex-1 flex flex-col justify-center px-8 overflow-y-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block py-4 font-blackletter text-3xl border-b border-border/40 transition-colors ${
                pathname === link.href
                  ? "text-gold"
                  : "text-foreground hover:text-gold"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Wallet at bottom */}
        <div className="px-8 pb-10 pt-6 border-t border-border shrink-0">
          <WalletMultiButton
            style={{
              backgroundColor: "#1a1a1a",
              color: "#f5f5f5",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: 0,
              width: "100%",
              justifyContent: "center",
              padding: "0.75rem 1rem",
              lineHeight: 1.5,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
