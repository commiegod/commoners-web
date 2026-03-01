import AuctionCarousel from "./components/AuctionCarousel";
import CurrentAuction from "./components/CurrentAuction";
import RecentAuctions from "./components/RecentAuctions";
import LandingAccordion from "./components/LandingAccordion";

export default function Home() {
  return (
    <div className="space-y-16 pb-16">
      <AuctionCarousel />
      <CurrentAuction />
      <RecentAuctions />

      {/* ── Tagline / Story section ── */}
      <section
        className="border-y border-border"
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      >
        <div className="px-5 py-16 md:py-24 text-center max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.2em] text-muted mb-5 uppercase">
            Commoner&apos;s SubDAO
          </p>
          <h2 className="font-blackletter text-3xl md:text-5xl text-gold mb-6 leading-tight">
            Every MidEvil Deserves Its Day.
          </h2>
          <p className="text-muted leading-relaxed mb-10 max-w-lg mx-auto">
            A community-owned institution on Solana. Holders of the 120
            identified Commoner NFTs govern a shared treasury, run daily
            auctions, and commission artwork — turning individual self-interest
            into collective good.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="/bounty"
              className="px-5 py-2.5 bg-gold text-card text-sm hover:opacity-80 transition-opacity"
            >
              Submit Artwork
            </a>
            <a
              href="/governance"
              className="px-5 py-2.5 border border-border text-muted text-sm hover:text-foreground hover:border-foreground transition-colors"
            >
              View Governance
            </a>
          </div>

        </div>
      </section>

      {/* ── WTF + Accordion ── */}
      <LandingAccordion />
    </div>
  );
}
