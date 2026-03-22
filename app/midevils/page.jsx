"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styles from "./midevils.module.css";

// ── Twitter embed helper ───────────────────────────────────────────────────────
// Renders a native X/Twitter embed card. The platform widget script transforms
// the <blockquote> into a full iframe card (avatar, text, images, stats).
function TweetEmbed({ url }) {
  return (
    <blockquote className="twitter-tweet" data-dnt="true" data-theme="dark">
      <a href={url}></a>
    </blockquote>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Image base URL: in production set NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL to
// your Vercel Blob / CDN prefix. Falls back to the local API route for dev.
const IMAGE_BASE =
  process.env.NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL?.replace(/\/$/, "") ?? "";

function imgUrl(path) {
  if (!path) return "";
  // Direct URLs (pbs.twimg.com etc.) — pass straight through, no proxying needed.
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // CDN/Blob mode: sanitize colons, encode each segment.
  if (IMAGE_BASE) {
    const safePath = path.replace(/:/g, "_");
    const encoded  = safePath.split("/").map(encodeURIComponent).join("/");
    return `${IMAGE_BASE}/${encoded}`;
  }
  // Local dev: serve via Next.js API route.
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/midevils/img/${encoded}`;
}

// ── Pulse canvas component ────────────────────────────────────────────────────
function PulseGraph({ weeks, maxScore, highlightIdx, onBarClick }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !weeks.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = 72;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const n    = weeks.length;
    const pad  = 4;
    const barW = Math.max(4, (W - pad * 2) / n - 2);
    const maxS = maxScore || 1;

    weeks.forEach((w, i) => {
      const x   = pad + i * ((W - pad * 2) / n);
      const val = w.score ?? w.count;
      const h   = Math.max(3, (val / maxS) * (H - 14));
      const y   = H - h - 4;

      let colour;
      if (i === highlightIdx)             colour = "#111111";
      else if (w.milestones?.length)      colour = "#7c5cfc";
      else if (val > maxS * 0.3)          colour = "#c8832a";
      else if (val > maxS * 0.1)          colour = "#aaaaaa";
      else                                colour = "#d0d0d0";

      ctx.fillStyle = colour;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barW, h, 3);
      } else {
        ctx.rect(x, y, barW, h);
      }
      ctx.fill();
    });
  }, [weeks, maxScore, highlightIdx]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !weeks.length) return;
    const rect = canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const idx  = Math.floor((x / canvas.offsetWidth) * weeks.length);
    if (idx >= 0 && idx < weeks.length) onBarClick(idx);
  }, [weeks, onBarClick]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.pulseCanvas}
      onClick={handleClick}
    />
  );
}

// ── Week card ─────────────────────────────────────────────────────────────────
function WeekCard({ week, maxCount, channelColors, isHighlighted, onImageClick }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll,   setShowAll]   = useState(false);

  const BATCH = 12;
  const visibleImgs = showAll ? week.images : week.images.slice(0, BATCH);
  const hiddenCount = week.images.length - BATCH;

  const pct = Math.round((week.count / Math.max(maxCount, 1)) * 100);

  const topChannels = Object.entries(week.channels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const hasMilestones = week.milestones?.length > 0;
  const hasArtist     = week.artistTweets?.length > 0;
  const hasHighlights = week.highlights?.length > 0;

  // Re-process any new tweet embeds whenever the card expands
  useEffect(() => {
    if (!collapsed) {
      window.twttr?.widgets.load();
    }
  }, [collapsed]);

  return (
    <div
      id={`wk-${week.week}`}
      className={`${styles.weekCard}${isHighlighted ? " " + styles.highlighted : ""}`}
    >
      {/* Header */}
      <div
        className={styles.weekHeader}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className={styles.weekLabelText}>{week.weekLabel}</span>
        <span className={styles.weekCount}>{week.count} images</span>
        <div className={styles.weekBarWrap}>
          <div className={styles.weekBar} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.chTags}>
          {topChannels.map(([ch, n]) => {
            const col = channelColors[ch] || "#888";
            return (
              <span
                key={ch}
                className={styles.chTag}
                style={{ color: col, borderColor: `${col}33` }}
              >
                {ch} {n}
              </span>
            );
          })}
        </div>
        {hasMilestones && <span className={styles.milestoneStar}>★ milestone</span>}
        {hasArtist     && <span className={styles.artistStar}>🎨 artist</span>}
      </div>

      {/* Body */}
      <div className={`${styles.weekBody}${collapsed ? " " + styles.collapsed : ""}`}>

        {/* ── Official milestones (@MidEvilsNFT) ──────────────────────────── */}
        {hasMilestones && (
          <div className={styles.tweetSection}>
            <div className={`${styles.tweetSectionLabel} ${styles.labelMilestone}`}>
              ★ official milestone
            </div>
            <div className={styles.embedGrid}>
              {week.milestones.map((m, i) => (
                <TweetEmbed key={i} url={m.url} />
              ))}
            </div>
          </div>
        )}

        {/* ── Artist work (@sircandyapple, @jonnydegods) ──────────────────── */}
        {hasArtist && (
          <div className={styles.tweetSection}>
            <div className={`${styles.tweetSectionLabel} ${styles.labelArtist}`}>
              🎨 artist work
            </div>
            <div className={styles.embedGrid}>
              {week.artistTweets.map((a, i) => (
                <TweetEmbed key={i} url={a.url} />
              ))}
            </div>
          </div>
        )}

        {/* ── Community highlights ─────────────────────────────────────────── */}
        {hasHighlights && (
          <div className={styles.tweetSection}>
            <div className={`${styles.tweetSectionLabel} ${styles.labelHighlight}`}>
              ★ community highlight
            </div>
            <div className={styles.embedGrid}>
              {week.highlights.map((h, i) => (
                <TweetEmbed key={i} url={h.url} />
              ))}
            </div>
          </div>
        )}

        {/* ── Community tweet image grid (meme_registry) ───────────────────── */}
        {week.commTweets?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className={styles.commLabel}>
              <span className={styles.commDot} />
              {week.commTweets.length} community tweet{week.commTweets.length !== 1 ? "s" : ""}
            </div>
            <div className={styles.imgGrid}>
              {week.commTweets.map((ct, i) => (
                <div
                  key={i}
                  className={`${styles.imgCard} ${styles.commCard}`}
                  onClick={() => onImageClick(imgUrl(ct.file))}
                >
                  <img
                    src={imgUrl(ct.file)}
                    alt={`@${ct.username}`}
                    loading="lazy"
                  />
                  <span className={styles.chDot} style={{ background: "#1d9bf0" }} />
                  {ct.tweetUrl
                    ? <a className={styles.commUsername} href={ct.tweetUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>@{ct.username}</a>
                    : <span className={styles.commUsername}>@{ct.username}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Discord image grid ───────────────────────────────────────────── */}
        <div className={styles.imgGrid}>
          {visibleImgs.map((img, i) => {
            const col = channelColors[img.channel] || "#888";
            return (
              <div
                key={i}
                className={styles.imgCard}
                onClick={() => onImageClick(imgUrl(img.file))}
              >
                <img
                  src={imgUrl(img.file)}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.closest(`.${styles.imgCard}`).style.display = "none"; }}
                />
                <span className={styles.chDot} style={{ background: col }} />
              </div>
            );
          })}
        </div>

        {!showAll && hiddenCount > 0 && (
          <button
            className={styles.showMore}
            onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
          >
            + {hiddenCount} more images
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Chronicle component ──────────────────────────────────────────────────
export default function MidevilsChronicle() {
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [searchQ,        setSearchQ]        = useState("");
  const [activeChannels, setActiveChannels] = useState(new Set());
  const [highlightIdx,   setHighlightIdx]   = useState(-1);
  const [lightboxSrc,    setLightboxSrc]    = useState(null);
  const [highlightedWk,  setHighlightedWk]  = useState(null);

  // Load Twitter embed widget script once, then re-process embeds whenever
  // data loads (blockquotes only exist in the DOM after the data fetch).
  useEffect(() => {
    const existing = document.querySelector('script[src*="platform.twitter.com"]');
    if (existing) return;
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.charset = "utf-8";
    // When the script finishes loading, process any blockquotes already in DOM
    s.onload = () => window.twttr?.widgets.load();
    document.body.appendChild(s);
  }, []);

  // Re-process embeds after data loads (script may already be ready by then)
  useEffect(() => {
    if (!data) return;
    const tryLoad = () => {
      if (window.twttr?.widgets) {
        window.twttr.widgets.load();
      } else {
        // Script not ready yet — retry shortly
        setTimeout(tryLoad, 300);
      }
    };
    // Small delay to let React commit the blockquotes to the DOM first
    setTimeout(tryLoad, 200);
  }, [data]);

  // Fetch timeline data
  useEffect(() => {
    fetch("/api/midevils/timeline")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setActiveChannels(new Set(Object.keys(d.channelColors)));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Pulse bar click: scroll to week and highlight
  const handleBarClick = useCallback((idx) => {
    if (!data) return;
    setHighlightIdx(idx);
    const wk = data.weeks[idx].week;
    setHighlightedWk(wk);
    const el = document.getElementById(`wk-${wk}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setHighlightedWk(null), 2000);
  }, [data]);

  // Channel filter toggle
  const toggleChannel = useCallback((ch) => {
    setActiveChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }, []);

  // Keyboard close lightbox
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Filtered months: apply search + channel filters to images
  const filteredMonths = useMemo(() => {
    if (!data) return [];
    const q = searchQ.toLowerCase().trim();
    return data.months.map((month) => ({
      ...month,
      weeks: month.weeks
        .map((week) => {
          const imgs = week.images.filter(
            (img) =>
              activeChannels.has(img.channel) &&
              (!q ||
                img.file.toLowerCase().includes(q) ||
                img.channel.toLowerCase().includes(q) ||
                (img.username ?? "").toLowerCase().includes(q) ||
                (img.author ?? "").toLowerCase().includes(q))
          );
          return { ...week, images: imgs };
        })
        .filter((w) => w.images.length > 0 || w.milestones.length > 0 || w.artistTweets?.length > 0 || w.highlights?.length > 0),
    })).filter((m) => m.weeks.length > 0);
  }, [data, searchQ, activeChannels]);

  const totalVisible = useMemo(
    () => filteredMonths.reduce((s, m) => s + m.weeks.reduce((ws, w) => ws + w.images.length, 0), 0),
    [filteredMonths]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.breakout}>
      <div className={styles.chronicle}>

        {/* Hero banner */}
        <div className={styles.heroBanner} />

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.headerTitle}>Midevils Scrolls</h1>
          <p className={styles.headerSub}>
            They&rsquo;re only half evil.<br />
            The MidEvils community pulse — memes shared, tweets that hit, weeks that went off.
          </p>
          {data && (
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={styles.statN}>{data.totalImages.toLocaleString()}</div>
                <div className={styles.statL}>Community Moments</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statN}>{data.weeks.length}</div>
                <div className={styles.statL}>Active Weeks</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statN}>{data.totalMilestones ?? 0}</div>
                <div className={styles.statL}>Milestone Tweets</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statN}>{data.totalArtist ?? 0}</div>
                <div className={styles.statL}>Artist Posts</div>
              </div>
            </div>
          )}
        </div>

        {/* Loading / error states */}
        {loading && (
          <div style={{ padding: "80px 36px", textAlign: "center", color: "#6868a0" }}>
            Loading chronicle…
          </div>
        )}
        {error && (
          <div style={{ padding: "80px 36px", textAlign: "center", color: "#fc5c5c" }}>
            Failed to load: {error}
          </div>
        )}

        {data && (
          <>
            {/* Pulse graph */}
            <div className={styles.pulseSection}>
              <div className={styles.pulseHeader}>
                <span className={styles.pulseLabel}>Community Activity Pulse</span>
                <div className={styles.pulseLegend}>
                  {[
                    ["#a070f0", "Milestone week"],
                    ["#c8832a", "High engagement"],
                    ["#7a4a20", "Active week"],
                    ["#3a2a18", "Low activity"],
                  ].map(([color, label]) => (
                    <span key={label} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <PulseGraph
                weeks={data.weeks}
                maxScore={data.maxScore}
                highlightIdx={highlightIdx}
                onBarClick={handleBarClick}
              />
              <div className={styles.pulseFooter}>
                <span className={styles.pulseDate}>
                  {data.weeks[0]?.weekLabel ?? ""}
                </span>
                <span className={styles.pulseHint}>Click any bar to jump to that week</span>
                <span className={styles.pulseDate}>
                  {data.weeks[data.weeks.length - 1]?.weekLabel ?? ""}
                </span>
              </div>
            </div>

            {/* Toolbar */}
            <div className={styles.toolbar}>
              <input
                className={styles.search}
                type="text"
                placeholder="Search images, channels…"
                autoComplete="off"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
              <div className={styles.chFilters}>
                {Object.entries(data.channelColors).map(([ch, color]) => (
                  <button
                    key={ch}
                    className={`${styles.chBtn}${activeChannels.has(ch) ? " " + styles.active : ""}`}
                    style={{ color, borderColor: color }}
                    onClick={() => toggleChannel(ch)}
                  >
                    {ch}
                  </button>
                ))}
              </div>
              <span className={styles.toolbarCount}>
                {totalVisible.toLocaleString()} images
              </span>
            </div>

            {/* Timeline */}
            <div className={styles.timeline}>
              {filteredMonths.map((month) => (
                <div key={month.key} className={styles.monthBlock}>
                  <div className={styles.monthHeading}>{month.label}</div>
                  {month.weeks.map((week) => (
                    <WeekCard
                      key={week.week}
                      week={week}
                      maxCount={data.maxCount}
                      channelColors={data.channelColors}
                      isHighlighted={week.week === highlightedWk}
                      onImageClick={setLightboxSrc}
                    />
                  ))}
                </div>
              ))}
              {filteredMonths.length === 0 && (
                <div style={{ padding: "60px 0", textAlign: "center", color: "#6868a0" }}>
                  No results match your filters.
                </div>
              )}
            </div>
          </>
        )}

        {/* Lightbox */}
        {lightboxSrc && (
          <div
            className={styles.lightbox}
            onClick={(e) => { if (e.target === e.currentTarget) setLightboxSrc(null); }}
          >
            <button className={styles.lbClose} onClick={() => setLightboxSrc(null)}>✕</button>
            <img className={styles.lbImg} src={lightboxSrc} alt="" />
          </div>
        )}
      </div>
    </div>
  );
}
