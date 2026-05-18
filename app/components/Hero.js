"use client";

// Centered homepage hero. Type-led — the auction grid below carries the art.
//
// Copy intentionally avoids marketing language and fee discussion. The
// structural facts are: holder-gated listing, open bidding. Anything about
// fees, treasury, or future token gating belongs on the Board, not here.

export default function Hero() {
  return (
    <section className="pt-10 md:pt-16 pb-8 md:pb-10 text-center">
      <p className="font-blackletter text-[11px] md:text-xs tracking-[0.3em] text-muted mb-4 uppercase">
        — For the MidEvils Community —
      </p>
      <h1 className="font-blackletter text-4xl md:text-6xl leading-[1.05] text-foreground mb-5 max-w-3xl mx-auto">
        Every MidEvil
        <br className="hidden md:block" />
        <span className="text-foreground/90"> deserves its day.</span>
      </h1>
      <p className="text-muted leading-relaxed text-sm md:text-base max-w-xl mx-auto mb-7">
        An open auction tool for the MidEvils collection. Hold a MidEvil —
        even just one — and you can list it. Anyone with a Solana wallet can
        bid.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="#schedule"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-blackletter tracking-wider rounded-full hover:opacity-85 transition-opacity"
        >
          List a MidEvil
        </a>
        <a
          href="#faq"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-muted text-sm font-blackletter tracking-wider rounded-full hover:text-foreground hover:border-foreground transition-colors"
        >
          How it works
        </a>
      </div>
    </section>
  );
}
