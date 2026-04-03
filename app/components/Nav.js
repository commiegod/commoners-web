"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import ConnectButton from "./ConnectButton";

const links = [
  { href: "/bounty", label: "Bounty" },
  { href: "/governance", label: "Governance" },
  { href: "/discussion", label: "The Board" },
  { href: "/gallery", label: "Gallery" },
  { href: "/midevils", label: "Scrolls" },
];

// Mid March Madness bracket pill lifecycle:
// - Before Apr 7 2026 end of day: LIVE
// - Apr 8–14 2026: show "Results" (no LIVE badge)
// - After Apr 14 2026: hidden
const BRACKET_LIVE_UNTIL   = new Date("2026-04-08T00:00:00");
const BRACKET_RESULTS_UNTIL = new Date("2026-04-15T00:00:00");
function getBracketPhase() {
  const now = new Date();
  if (now < BRACKET_LIVE_UNTIL)    return "live";
  if (now < BRACKET_RESULTS_UNTIL) return "results";
  return "hidden";
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-background relative z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2">
          <img src="/icon.png" alt="" className="h-9 w-auto" />
          <img src="/wordmark.png" alt="Commoner's DAO" className="h-6 w-auto" style={{ mixBlendMode: "multiply" }} />
        </Link>

        {/* Desktop links + wallet */}
        <div className="hidden sm:flex items-center gap-6">
          {/* Bracket — featured link, lifecycle-aware */}
          {getBracketPhase() !== "hidden" && (
            <Link
              href="/bracket"
              className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                pathname === "/bracket"
                  ? "bg-gold text-card border-gold"
                  : "bg-gold/10 text-gold border-gold/40 hover:bg-gold/20"
              }`}
            >
              <span>🏀</span>
              <span className="font-blackletter tracking-wide">Mid March Madness</span>
              {getBracketPhase() === "live" && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-px rounded-full leading-none uppercase tracking-wide">
                  Live
                </span>
              )}
              {getBracketPhase() === "results" && (
                <span className="absolute -top-2 -right-2 bg-foreground text-background text-[9px] font-bold px-1.5 py-px rounded-full leading-none uppercase tracking-wide">
                  Results
                </span>
              )}
            </Link>
          )}

          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-blackletter text-sm tracking-wide transition-colors ${
                pathname === link.href
                  ? "text-gold"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <ConnectButton
            style={{
              backgroundColor: "transparent",
              border: "1px solid #1a1a1a",
              color: "#1a1a1a",
              fontSize: "0.75rem",
              borderRadius: "9999px",
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
            <img src="/icon.png" alt="" className="h-9 w-auto" />
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
          {/* Bracket — featured, lifecycle-aware */}
          {getBracketPhase() !== "hidden" && (
            <Link
              href="/bracket"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 py-4 font-blackletter text-3xl border-b border-border/40 transition-colors ${
                pathname === "/bracket" ? "text-gold" : "text-foreground hover:text-gold"
              }`}
            >
              <span>🏀</span>
              <span>Mid March Madness</span>
              {getBracketPhase() === "live" && (
                <span className="ml-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-px rounded-full leading-none uppercase tracking-wide self-center">
                  Live
                </span>
              )}
              {getBracketPhase() === "results" && (
                <span className="ml-1 bg-foreground text-background text-[9px] font-bold px-1.5 py-px rounded-full leading-none uppercase tracking-wide self-center">
                  Results
                </span>
              )}
            </Link>
          )}

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
          <ConnectButton
            style={{
              backgroundColor: "#1a1a1a",
              color: "#f5f5f5",
              fontSize: "0.875rem",
              fontWeight: 600,
              borderRadius: "9999px",
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
