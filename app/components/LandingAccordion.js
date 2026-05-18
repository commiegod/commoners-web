"use client";

// LandingAccordion — homepage FAQ. The intro heading + paragraph moved up
// into page.js (DropCap-led story section) so this component is FAQ only.
// COMMON token references are removed entirely — the token model is being
// discussed on the board and shouldn't appear on the marketing surface
// until the community has ratified it.

import { useState } from "react";

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
    <section className="max-w-2xl mx-auto" id="faq">
      <p className="font-blackletter text-[11px] tracking-[0.3em] text-muted text-center mb-4 uppercase">
        Questions from the Square
      </p>
      <h2 className="font-blackletter text-2xl md:text-3xl text-foreground text-center mb-6 tracking-wide">
        How it Works
      </h2>

      <div className="border-t border-border">
        <AccordionItem title="Who Are Commoners">
          <p className="text-muted leading-relaxed">
            In the MidEvils collection, most NFTs carry 4–8 visible traits.
            Commoners are the rare subset with exactly 3 non-&quot;None&quot;
            traits — Background, Skin, and one additional trait — making them
            the simplest, most minimal characters in the set. Each Commoner
            NFT grants 1 vote in DAO governance.
          </p>
        </AccordionItem>

        <AccordionItem title="How Auctions Work">
          <div className="mb-4 px-3 py-2 border border-border/60 rounded text-xs text-muted bg-card">
            The auction system is currently running on Solana devnet for
            testing. Mainnet launch is the next milestone — auctions go live
            once the program is deployed and the first mainnet listing is
            settled.
          </div>
          <ul className="text-muted leading-relaxed space-y-2 list-disc list-inside">
            <li>
              <span className="text-foreground font-medium">
                Any MidEvil can be listed.
              </span>{" "}
              The whole collection is eligible — Commoners and non-Commoners
              alike. If you own one, you can list it. No curation, no waitlist.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Listing is holder-gated.
              </span>{" "}
              You need to hold the MidEvil you&apos;re listing — that&apos;s
              the only requirement. Even a single MidEvil qualifies you to
              use the tool.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Bidding is wide open.
              </span>{" "}
              Anyone with a Solana wallet can bid. No DAO membership, no token
              gate, no minimum balance.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Free for the community.
              </span>{" "}
              No listing fee. No fee on sale. MidEvils holders keep the full
              proceeds when an auction settles. The seller pays only the
              standard Solana network rent on the listing PDA, which is
              refunded automatically at settlement.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Reserve protection.
              </span>{" "}
              If the seller&apos;s reserve isn&apos;t met by auction end,
              the NFT returns to the seller&apos;s wallet automatically.
              Nothing changes hands.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Anti-snipe protection.
              </span>{" "}
              A bid placed in the final ten minutes automatically extends
              the auction&apos;s close, so last-second bidders can&apos;t
              steal the win.
            </li>
          </ul>
        </AccordionItem>

        <AccordionItem title="Governance">
          <p className="text-muted leading-relaxed mb-4">
            Governance operates in three layers:
          </p>
          <ul className="text-muted leading-relaxed space-y-2 list-disc list-inside mb-6">
            <li>
              <span className="text-foreground font-medium">
                NFT Vote (Layer 1)
              </span>{" "}
              — 51% yes majority, 24/120 quorum required. Standard proposals,
              parameter changes, bounties, and treasury requests under 5 SOL.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Futarchy Prioritization (Layer 2, planned)
              </span>{" "}
              — Prediction markets rank competing proposals by expected
              impact. Planned for a future phase.
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
                  <td className="px-3 py-2">75%</td>
                  <td className="px-3 py-2">36 / 120</td>
                </tr>
              </tbody>
            </table>
          </div>
        </AccordionItem>

        <AccordionItem title="Burns & The Graveyard">
          <p className="text-muted leading-relaxed mb-4">
            Burning a Commoner NFT is an irreversible action — and it carries
            a permanent consequence for governance. If you burn your 3-trait
            MidEvil, you forfeit your membership in the Commoner&apos;s DAO.
            The burned NFT no longer registers in the eligibility check, so
            the wallet loses its vote immediately.
          </p>
          <p className="text-muted leading-relaxed mb-4">
            This is intentional. The DAO&apos;s health depends on active,
            participating holders. Locking up governance tokens through burns
            sounds compelling, but it tends to concentrate power without
            improving decisions — and it severs the holder from the community
            they helped build. Keeping your Commoner means keeping your seat
            at the table, and keeping the asset liquid for whatever comes
            next.
          </p>
          <p className="text-muted leading-relaxed mb-5">
            Burned Commoners aren&apos;t forgotten. They live on as soulbound
            tokens in the{" "}
            <strong className="text-foreground">MidEvil Graveyard</strong>{" "}
            collection — a permanent on-chain record of every character that
            was sacrificed. We&apos;ve built a shrine to honor them.
          </p>
          <a
            href="/graveyard"
            className="inline-block px-4 py-2 border border-border text-muted text-sm hover:text-foreground hover:border-foreground transition-colors"
          >
            Visit the Graveyard ↗
          </a>
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
