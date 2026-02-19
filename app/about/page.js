export default function AboutPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-blackletter text-3xl text-gold mb-6">About</h1>

      <div className="space-y-8">
        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">Mission</h2>
          <p className="text-muted leading-relaxed">
            The Commoner&apos;s SubDAO is governed by the holders of the 120
            identified 3-trait MidEvils NFTs. We run daily
            auctions where any MidEvil can be listed for sale, commission artist
            bounty artwork for each auctioned piece, and govern the SubDAO
            through simple yes/no proposals.
          </p>
        </section>

        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">How It Works</h2>
          <div className="space-y-4 text-muted leading-relaxed">
            <div className="bg-card border border-border p-4">
              <h3 className="text-foreground font-medium mb-1">
                Daily Auctions
              </h3>
              <p>
                Each day, one MidEvil NFT is featured in an auction. Any MidEvil
                holder can list their NFT — it doesn&apos;t have to be a Commoner.
                The seller receives the proceeds minus a fee that goes to the
                SubDAO treasury. In the future, a minimum COMMON token balance
                will be required to list.
              </p>
            </div>
            <div className="bg-card border border-border p-4">
              <h3 className="text-foreground font-medium mb-1">
                Artist Bounties
              </h3>
              <p>
                Both human artists and AI tools are used to create artwork
                inspired by each day&apos;s featured NFT. Submissions are displayed
                alongside the original on the auction page.
              </p>
            </div>
            <div className="bg-card border border-border p-4">
              <h3 className="text-foreground font-medium mb-1">Governance</h3>
              <p>
                The SubDAO is governed by Commoner holders (3-trait MidEvils)
                through simple yes/no proposals.
              </p>
            </div>
            <div className="bg-card border border-border p-4">
              <h3 className="text-foreground font-medium mb-1">
                COMMON Token
              </h3>
              <p>
                A COMMON token is planned to gate auction access and align
                incentives. Holding a minimum amount of COMMON will be required
                to list a MidEvil for auction, opening participation beyond just
                Commoner holders.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">What is a Commoner?</h2>
          <p className="text-muted leading-relaxed">
            In the MidEvils collection, most NFTs have 4–8 visible traits.
            Commoners are the rare subset with exactly 3 non-&quot;None&quot; traits —
            making them the simplest, most minimal characters in the collection.
            There are only 120 of them. Commoner holders govern the SubDAO.
          </p>
        </section>

        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">
            Who can auction a MidEvil?
          </h2>
          <p className="text-muted leading-relaxed">
            Any MidEvil from the full collection can be listed in a daily
            auction — not just Commoners. During the bootstrapping period, the
            founder curates the schedule. Long-term, COMMON token holders will
            be able to list their MidEvils directly.
          </p>
        </section>

        <section>
          <h2 className="font-blackletter text-xl text-gold mb-3">Governance Document</h2>
          <p className="text-muted leading-relaxed mb-3">
            The full governance framework (v1.2) defines voting rules, treasury
            management, and proposal procedures.
          </p>
          <a
            href="/docs/governance-v1.2.md"
            target="_blank"
            className="inline-block px-4 py-2 border border-gold/30 text-gold text-sm hover:bg-gold/10 transition-colors"
          >
            View Governance Doc (v1.2)
          </a>
        </section>
      </div>
    </div>
  );
}
