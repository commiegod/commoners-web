import graveyardData from "../../data/graveyard.json";
import Link from "next/link";

export const metadata = {
  title: "The Graveyard — Commoner's DAO",
  description:
    "A shrine to the Commoner NFTs that were burned. They gave up their seat at the table — they won't be forgotten.",
};

function BurnedCard({ nft }) {
  const haData = nft.id && nft.image;

  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* Image */}
      <div className="aspect-square bg-background relative overflow-hidden">
        {haData ? (
          <img
            src={nft.image}
            alt={nft.name}
            className="w-full h-full object-cover grayscale opacity-70"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted/30 text-5xl select-none">
            ✝
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-2">
          <p className="text-white text-xs font-mono opacity-60">Burned</p>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <p className="font-blackletter text-lg text-foreground mb-1">{nft.name}</p>
        {nft.burnedAt && (
          <p className="text-xs text-muted mb-2">
            {new Date(nft.burnedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
        {nft.traits && nft.traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {nft.traits.map((t) => (
              <span
                key={t.trait_type}
                className="text-[10px] border border-border px-2 py-0.5 text-muted"
              >
                {t.value}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-3 text-xs">
          {nft.id && (
            <a
              href={`https://solscan.io/token/${nft.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-foreground transition-colors"
            >
              Original ↗
            </a>
          )}
          {nft.graveyardMint && (
            <a
              href={`https://solscan.io/token/${nft.graveyardMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-foreground transition-colors"
            >
              Graveyard ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GraveyardPage() {
  const burned = graveyardData.burned ?? [];
  const populated = burned.filter((n) => n.id || n.name !== "MidEvil #???");
  const total = burned.length;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs tracking-[0.2em] text-muted mb-3 uppercase">The Graveyard</p>
        <h1 className="font-blackletter text-3xl sm:text-5xl text-foreground leading-tight mb-4">
          They Gave Up Their Seat.
        </h1>
        <p className="text-muted leading-relaxed mb-4">
          Five Commoner NFTs have been burned — sacrificed in events past. Each one was a
          3-trait MidEvil that held a vote in the DAO. They no longer do.
        </p>
        <p className="text-muted leading-relaxed">
          Their on-chain record lives on as a soulbound token in the{" "}
          <a
            href="https://tensor.trade/trade/midevil_graveyard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-gold transition-colors underline underline-offset-2"
          >
            MidEvil Graveyard
          </a>{" "}
          collection — permanent, untransferable, and honored here.
        </p>
      </div>

      {/* Rule */}
      <div className="border border-border/60 bg-card px-5 py-4 mb-10 text-sm text-muted leading-relaxed">
        <span className="text-foreground font-medium">DAO policy:</span> Burning a Commoner
        forfeits all governance rights. The burned wallet loses eligibility immediately and
        permanently. This keeps governance power with active, participating holders — and keeps
        Commoner NFTs liquid and meaningful.{" "}
        <Link href="/#faq" className="text-gold hover:underline">
          Learn more ↗
        </Link>
      </div>

      {/* Grid */}
      {populated.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
          {burned.map((nft, i) => (
            <BurnedCard key={i} nft={nft} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
          {burned.map((nft, i) => (
            <BurnedCard key={i} nft={nft} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted border-t border-border pt-5">
        {total} Commoner{total !== 1 ? "s" : ""} burned •{" "}
        {115} remain eligible for governance
      </p>

      <div className="mt-6">
        <Link
          href="/gallery"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Back to the Gallery
        </Link>
      </div>
    </div>
  );
}
