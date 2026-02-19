import AuctionHero from "./components/AuctionHero";
import RecentAuctions from "./components/RecentAuctions";
import commoners from "../data/commoners.json";

export default function Home() {
  return (
    <div className="space-y-16">
      <AuctionHero />
      <RecentAuctions />

      {/* Community Stats Bar */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-muted py-4 border-t border-border">
        <span>
          <span className="text-gold font-semibold">{commoners.totalCommoners}</span> Commoners
        </span>
        <span>
          Treasury: <span className="text-gold font-semibold">-- SOL</span>
        </span>
      </div>
    </div>
  );
}
