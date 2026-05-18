// Homepage composition — type-led hero, multi-auction grid with empty
// state, the existing schedule (kept for the "List your NFT" entry point),
// a workshop strip pulling recent MidEvils art, and the lore section.
//
// AuctionGrid replaces CurrentAuction's role on the homepage; CurrentAuction
// stays in the codebase so other surfaces or admin tooling can still use it.

import Hero from "./components/Hero";
import Divider from "./components/Divider";
import AuctionGrid from "./components/AuctionGrid";
import RecentAuctions from "./components/RecentAuctions";
import WorkshopStrip from "./components/WorkshopStrip";
import LandingAccordion from "./components/LandingAccordion";
import DropCap from "./components/DropCap";

export default function Home() {
  return (
    <div className="space-y-12 md:space-y-16 pb-16">
      <Hero />

      <Divider variant="trefoil" />

      <AuctionGrid />

      {/* Devnet note — small, factual, unobtrusive */}
      <p className="text-center text-xs text-muted/70 -mt-4">
        Auctions run on Solana devnet during the testing phase.{" "}
        <a
          href="#faq"
          className="hover:text-muted underline underline-offset-2 transition-colors"
        >
          What does that mean?
        </a>
      </p>

      {/* Schedule / list-your-NFT entry point — kept from the previous
          homepage so holders can list a slot from the same surface. */}
      <section id="schedule">
        <RecentAuctions />
      </section>

      <Divider variant="quatrefoil" />

      <WorkshopStrip />

      <Divider variant="cross" />

      {/* Story section with illuminated drop cap. The lore moves from a
          separate "Tagline" block into the accordion's intro to keep the
          page rhythm tighter. */}
      <section className="max-w-2xl mx-auto px-2">
        <p className="font-blackletter text-[11px] tracking-[0.3em] text-muted text-center mb-4 uppercase">
          Commoner's DAO
        </p>
        <h2 className="font-blackletter text-3xl md:text-4xl text-foreground text-center mb-8 leading-tight">
          Common folk. Uncommon purpose.
        </h2>
        <DropCap className="text-foreground/90 text-base">
          The Commoner's DAO turns individual self-interest into collective
          good. Holders of three-trait Commoner MidEvils govern a shared
          treasury, run open auctions, and commission artwork — building a
          community-owned institution on Solana that rewards participation and
          grows in value with every settlement.
        </DropCap>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/governance"
            className="inline-flex items-center px-5 py-2.5 border border-border text-muted text-sm font-blackletter tracking-wider rounded-full hover:text-foreground hover:border-foreground transition-colors"
          >
            View Governance
          </a>
          <a
            href="https://discord.gg/midevilsnft"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-5 py-2.5 border border-border text-muted text-sm font-blackletter tracking-wider rounded-full hover:text-foreground hover:border-foreground transition-colors"
          >
            Join the Discord ↗
          </a>
        </div>
      </section>

      <LandingAccordion />
    </div>
  );
}
