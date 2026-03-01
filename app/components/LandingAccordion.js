"use client";

import { useState } from "react";
import feeConfig from "../../data/fee-config.json";

function AccordionItem({ title, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
      >
        <span className="font-blackletter text-lg md:text-xl text-foreground">
          {title}
        </span>
        <span className="text-xl text-muted leading-none ml-4 select-none">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="pb-6">{children}</div>}
    </div>
  );
}

export default function LandingAccordion() {
  return (
    <section className="max-w-2xl">
      <h2 className="font-blackletter text-2xl md:text-3xl text-gold mb-4">
        Common Folk. Uncommon Purpose.
      </h2>
      <p className="text-muted leading-relaxed mb-8">
        The Commoner&apos;s DAO turns individual self-interest into collective
        good. Holders of the 120 identified 3-trait MidEvils govern a shared
        treasury, run daily auctions, and commission artwork — building a
        community-owned institution on Solana that rewards participation and
        grows in value with every auction.
      </p>

      <div className="border-t border-border">
        <AccordionItem title="Who Are Commoners">
          <p className="text-muted leading-relaxed">
            In the MidEvils collection, most NFTs carry 4–8 visible traits.
            Commoners are the rare subset with exactly 3 non-&quot;None&quot; traits —
            Background, Skin, and one additional trait — making them the
            simplest, most minimal characters in the set. There are exactly 120
            of them. Each Commoner NFT grants 1 vote in DAO governance.
          </p>
        </AccordionItem>

        <AccordionItem title="Daily Auctions">
          <ul className="text-muted leading-relaxed space-y-2 list-disc list-inside">
            <li>Any MidEvil NFT (not just Commoners) can be listed for auction.</li>
            <li>Each auction runs for 24 hours starting at midnight UTC.</li>
            <li>
              A fee on the final sale price is sent to the DAO treasury;
              proceeds go to the seller.
            </li>
            <li>
              During the bootstrapping phase, the founder curates the schedule.
              Long-term, COMMON holders list directly.
            </li>
            <li>
              If no bids are placed, the auction ends with no fee charged and
              the NFT returned to the seller.
            </li>
          </ul>
        </AccordionItem>

        <AccordionItem title="Governance">
          <p className="text-muted leading-relaxed mb-4">
            Governance operates in three layers:
          </p>
          <ul className="text-muted leading-relaxed space-y-2 list-disc list-inside mb-6">
            <li>
              <span className="text-foreground font-medium">NFT Vote (Layer 1)</span>{" "}
              — 51% yes majority, 24/120 quorum required. Standard proposals,
              parameter changes, bounties, and treasury requests under 5 SOL.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Futarchy Prioritization (Layer 2, Phase 4)
              </span>{" "}
              — MetaDAO prediction markets rank competing proposals by expected
              impact. Active from Phase 4 onwards.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Treasury Supermajority (Layer 3)
              </span>{" "}
              — higher thresholds for large treasury actions.
            </li>
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    Treasury Ask
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    Majority
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    Quorum
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">&lt; 5 SOL</td>
                  <td className="px-3 py-2">51%</td>
                  <td className="px-3 py-2">24 / 120</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">5 – 20 SOL</td>
                  <td className="px-3 py-2">67%</td>
                  <td className="px-3 py-2">36 / 120</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted">&gt; 20 SOL</td>
                  <td className="px-3 py-2">75% + futarchy</td>
                  <td className="px-3 py-2">36 / 120</td>
                </tr>
              </tbody>
            </table>
          </div>
        </AccordionItem>

        <AccordionItem title="COMMON Token">
          <p className="text-muted leading-relaxed mb-4">
            Fixed supply of 1,000,000,000 COMMON. No team or founder allocation —
            all distribution is community-driven. Holders of the 120 Commoner NFTs
            receive the primary airdrop and hold governance rights. The broader
            MidEvils community receives a smaller allocation to enable futarchy
            market participation (Phase 4) and platform alignment without diluting
            Commoner governance power. Purpose: auction fee reduction, artist
            bounty rewards, DAO liquidity, staking yield, and futarchy.
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    Allocation
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    Amount
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">Commoner Airdrop</td>
                  <td className="px-3 py-2 text-muted">600M (60%)</td>
                  <td className="px-3 py-2 text-muted">
                    ~5M per Commoner NFT — pro-rata to all holders of the 120 Commoner NFTs at Phase 3 snapshot
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">MidEvil Airdrop</td>
                  <td className="px-3 py-2 text-muted">100M (10%)</td>
                  <td className="px-3 py-2 text-muted">
                    ~20,490 per non-Commoner MidEvil — enables futarchy participation
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">Bounty Rewards</td>
                  <td className="px-3 py-2 text-muted">150M (15%)</td>
                  <td className="px-3 py-2 text-muted">
                    Artist bounty pool; DAO can vote to replenish via open-market buys
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">DAO Liquidity</td>
                  <td className="px-3 py-2 text-muted">100M (10%)</td>
                  <td className="px-3 py-2 text-muted">
                    SOL/COMMON pool managed by treasury; LP fees build the treasury
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Staking Emissions</td>
                  <td className="px-3 py-2 text-muted">50M (5%)</td>
                  <td className="px-3 py-2 text-muted">
                    Earned by locking COMMON 30/90/180 days (Phase 4)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-sm font-medium mb-2">Auction Fee Tiers</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    COMMON Held
                  </th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">
                    Auction Fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {feeConfig.tiers.map((tier, i) => (
                  <tr
                    key={i}
                    className={i < feeConfig.tiers.length - 1 ? "border-b border-border" : ""}
                  >
                    <td className="px-3 py-2 text-muted">
                      {tier.maxCommon === null
                        ? `≥ ${tier.minCommon.toLocaleString()}`
                        : tier.minCommon === 0
                        ? `< ${(tier.maxCommon + 1).toLocaleString()}`
                        : `${tier.minCommon.toLocaleString()} – ${tier.maxCommon.toLocaleString()}`}
                    </td>
                    <td className="px-3 py-2">
                      {tier.feePercent === 0
                        ? "0% (fee-free)"
                        : `${tier.feePercent}% (${tier.label.toLowerCase()})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Listing requires a minimum of {feeConfig.listingMinimum.toLocaleString()} COMMON.
            The zero-fee threshold is the first governance proposal — the community votes to
            confirm or adjust the exact amounts.
          </p>
        </AccordionItem>

        <AccordionItem title="Links & Resources">
          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com/commiegod/commoners-web/blob/main/GOVERNANCE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 border border-border text-muted text-sm hover:text-foreground hover:border-foreground transition-colors"
            >
              Governance Doc ↗
            </a>
            <a
              href="https://github.com/commiegod/commoners-web"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 border border-border text-muted text-sm hover:text-foreground hover:border-foreground transition-colors"
            >
              GitHub ↗
            </a>
          </div>
        </AccordionItem>
      </div>
    </section>
  );
}
