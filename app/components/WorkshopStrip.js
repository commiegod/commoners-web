// TownCrier — curated tweets from across the MidEvils community.
//
// Pulls from top_tweets_registry.json — entries are added by hand via the
// admin Scrolls tab (POST /api/admin/add-tweet). Any X account works:
// official MidEvils, artists, community members. The strip filters to
// entries with at least one image, sorts newest-first by date, and shows
// the most recent five.
//
// File name kept as WorkshopStrip.js for import-stability; the section
// renders as "From the Town Crier" in the UI.

import topTweets from "../../data/midevils/top_tweets/top_tweets_registry.json";

function pickRecentTweets(tweets, count = 5) {
  return [...tweets]
    .filter((t) => Array.isArray(t.images) && t.images.length > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, count);
}

function formatDateLabel(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function WorkshopStrip() {
  const items = pickRecentTweets(topTweets, 5);
  if (!items.length) return null;

  return (
    <section id="crier">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="font-blackletter text-xl md:text-2xl text-foreground tracking-wide">
          From the Town Crier
        </h2>
        <a
          href="https://x.com/MidEvilsNFT"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-muted tracking-widest font-blackletter hover:text-foreground transition-colors"
        >
          FOLLOW @MIDEVILSNFT ↗
        </a>
      </header>

      <p className="text-sm text-muted leading-relaxed mb-4 max-w-xl">
        Hand-curated moments from the MidEvils community — drops, fan art,
        and dispatches worth seeing. Click any to read.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {items.map((tweet) => {
          const src = tweet.images[0];
          const dateLabel = formatDateLabel(tweet.date);
          const handle = tweet.username ? `@${tweet.username}` : "";
          return (
            <a
              key={tweet.id}
              href={tweet.url}
              target="_blank"
              rel="noreferrer"
              className="group relative block aspect-square bg-card border border-border overflow-hidden hover:border-foreground/60 transition-colors"
              aria-label={`Tweet by ${handle || "the community"} from ${dateLabel}`}
            >
              <img
                src={src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] tracking-widest font-blackletter px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between gap-2">
                <span className="truncate">{handle.toUpperCase()}</span>
                <span className="shrink-0">{dateLabel.toUpperCase()}</span>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
