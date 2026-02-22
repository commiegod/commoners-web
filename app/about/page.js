export default function AboutPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-blackletter text-3xl text-gold mb-10">About</h1>

      <div className="space-y-10">
        {/* 1. Mission */}
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">
            What is the Commoner&apos;s SubDAO
          </h2>
          <p className="text-muted leading-relaxed">
            The Commoner&apos;s SubDAO turns individual self-interest into
            collective good. Holders of the 120 identified 3-trait MidEvils
            govern a shared treasury, run daily auctions, and commission artwork
            — building a community-owned institution on Solana that rewards
            participation and grows in value with every auction.
          </p>
        </section>

        {/* 2. Who are Commoners */}
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">
            Who Are Commoners
          </h2>
          <p className="text-muted leading-relaxed">
            In the MidEvils collection, most NFTs carry 4–8 visible traits.
            Commoners are the rare subset with exactly 3 non-&quot;None&quot; traits —
            Background, Skin, and one additional trait — making them the
            simplest, most minimal characters in the set. There are exactly 120
            of them. Each Commoner NFT grants 1 vote in SubDAO governance.
          </p>
        </section>

        {/* 3. Daily Auctions */}
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">
            Daily Auctions
          </h2>
          <ul className="text-muted leading-relaxed space-y-2 list-disc list-inside">
            <li>Any MidEvil NFT (not just Commoners) can be listed for auction.</li>
            <li>Each auction runs for 24 hours starting at midnight UTC.</li>
            <li>
              A fee on the final sale price is sent to the SubDAO treasury;
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
        </section>

        {/* 4. Governance */}
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">
            Governance
          </h2>
          <p className="text-muted leading-relaxed mb-4">
            Governance operates in three layers:
          </p>
          <ul className="text-muted leading-relaxed space-y-2 list-disc list-inside mb-4">
            <li>
              <span className="text-foreground font-medium">NFT Vote (Layer 1)</span> — 51% yes majority, 24/120 quorum required.
              Standard proposals, parameter changes, bounties, and
              treasury requests under 5 SOL.
            </li>
            <li>
              <span className="text-foreground font-medium">Futarchy Prioritization (Layer 2, Phase 4)</span> — MetaDAO
              prediction markets rank competing proposals by expected impact.
              Active from Phase 4 onwards.
            </li>
            <li>
              <span className="text-foreground font-medium">Treasury Supermajority (Layer 3)</span> — higher thresholds
              for large treasury actions.
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
        </section>

        {/* 5. COMMON Token */}
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">
            COMMON Token
          </h2>
          <p className="text-muted leading-relaxed mb-4">
            Fixed supply of 1,000,000,000 COMMON. No team or founder allocation —
            all distribution is community-driven. Commoner holders receive the
            primary airdrop and hold governance rights. The broader MidEvils
            community receives a smaller allocation to enable futarchy market
            participation (Phase 4) and platform alignment without diluting
            Commoner governance power. Purpose: auction fee reduction, artist
            bounty rewards, DAO liquidity, staking yield, and futarchy.
          </p>

          {/* Allocation table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">Allocation</th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">Amount</th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">Commoner Airdrop</td>
                  <td className="px-3 py-2 text-muted">600,000,000 (60%)</td>
                  <td className="px-3 py-2 text-muted">
                    ~5,000,000 per Commoner NFT — pro-rata to all 120 holders at Phase 3 snapshot
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">MidEvil Airdrop</td>
                  <td className="px-3 py-2 text-muted">100,000,000 (10%)</td>
                  <td className="px-3 py-2 text-muted">
                    ~20,490 per non-Commoner MidEvil — enables futarchy participation for the broader community
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">Bounty Rewards</td>
                  <td className="px-3 py-2 text-muted">150,000,000 (15%)</td>
                  <td className="px-3 py-2 text-muted">
                    Artist bounty pool; DAO can vote to replenish via open-market buys
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2">DAO Liquidity</td>
                  <td className="px-3 py-2 text-muted">100,000,000 (10%)</td>
                  <td className="px-3 py-2 text-muted">
                    SOL/COMMON liquidity pool managed by treasury; LP fees build the treasury
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Staking Emissions</td>
                  <td className="px-3 py-2 text-muted">50,000,000 (5%)</td>
                  <td className="px-3 py-2 text-muted">
                    Earned by locking COMMON for 30 / 90 / 180 days (Phase 4); released only by governance vote
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Auction fee tiers */}
          <h3 className="text-sm font-medium mb-2">Auction Fee Tiers</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">COMMON Held</th>
                  <th className="text-left px-3 py-2 text-xs text-muted tracking-widest font-normal uppercase">Auction Fee</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">&lt; 50,000</td>
                  <td className="px-3 py-2">5% (standard)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-muted">50,000 – 499,999</td>
                  <td className="px-3 py-2">3% (reduced)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted">≥ 500,000</td>
                  <td className="px-3 py-2">0% (fee-free)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            The 500,000 COMMON zero-fee threshold is the first governance proposal — the community votes on the exact amount.
            Active bounty artists can accumulate COMMON through rewards. Regular MidEvil holders would need to buy COMMON or earn it through the platform to access reduced fees.
          </p>
        </section>

        {/* 6. Links */}
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">Links</h2>
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
        </section>
      </div>
    </div>
  );
}
