"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./midevils.module.css";

// ── Twitter embed helper ───────────────────────────────────────────────────────
function TweetEmbed({ url }) {
  const ref       = useRef(null);
  const loadedRef = useRef(false);
  const tweetId   = (url ?? "").match(/\/status\/(\d+)/)?.[1];

  useEffect(() => {
    if (!ref.current || !tweetId) return;
    const container = ref.current;
    loadedRef.current = false;

    const doCreate = () => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      const tryCreate = () => {
        if (window.twttr?.widgets?.createTweet) {
          container.innerHTML = "";
          window.twttr.widgets.createTweet(tweetId, container, { theme: "light", dnt: true });
        } else {
          setTimeout(tryCreate, 300);
        }
      };
      tryCreate();
    };

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { observer.disconnect(); doCreate(); } },
      { rootMargin: "400px" }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [tweetId]);

  return <div ref={ref} />;
}

// ── Image URL helper ───────────────────────────────────────────────────────────
const IMAGE_BASE =
  process.env.NEXT_PUBLIC_MIDEVILS_IMAGE_BASE_URL?.replace(/\/$/, "") ?? "";

function imgUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (IMAGE_BASE) {
    const safePath = path.replace(/:/g, "_");
    const encoded  = safePath.split("/").map(encodeURIComponent).join("/");
    return `${IMAGE_BASE}/${encoded}`;
  }
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/midevils/img/${encoded}`;
}

// ── Pulse canvas component ────────────────────────────────────────────────────
function PulseGraph({ weeks, maxScore, selectedIdx, onBarClick }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !weeks.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = 88;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const n    = weeks.length;
    const pad  = 4;
    const gap  = 2;
    const barW = Math.max(3, (W - pad * 2) / n - gap);
    const maxS = maxScore || 1;

    weeks.forEach((w, i) => {
      const x   = pad + i * ((W - pad * 2) / n);
      const val = w.score ?? w.count ?? 0;
      const h   = Math.max(3, (val / maxS) * (H - 16));
      const y   = H - h - 4;

      const isSelected = i === selectedIdx;

      let colour;
      if (isSelected)              colour = "#111111";
      else if (w.hasMilestones)    colour = "#7c5cfc";
      else if (val > maxS * 0.35)  colour = "#c8832a";
      else if (val > maxS * 0.12)  colour = "#999999";
      else                         colour = "#d0d0d0";

      ctx.fillStyle = colour;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, barW, h, 3);
      else               ctx.rect(x, y, barW, h);
      ctx.fill();

      if (isSelected) {
        ctx.fillStyle = "#111111";
        ctx.beginPath();
        ctx.arc(x + barW / 2, H - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [weeks, maxScore, selectedIdx]);

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

// ── Full week content ─────────────────────────────────────────────────────────
function WeekContent({ weekKey, channelColors, onImageClick }) {
  const [weekData, setWeekData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [showAll,  setShowAll]  = useState(false);

  const BATCH = 24;

  useEffect(() => {
    if (!weekKey) return;
    setLoading(true);
    setError(null);
    setWeekData(null);
    setShowAll(false);

    fetch(`/api/midevils/timeline/${weekKey}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setWeekData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [weekKey]);

  if (loading) return (
    <div className={styles.weekContentLoading}>
      <div className={styles.weekContentSpinner} />
      <span>Loading week…</span>
    </div>
  );

  if (error) return (
    <div className={styles.weekContentError}>Failed to load: {error}</div>
  );

  if (!weekData) return null;

  const allImgs    = weekData.images ?? [];
  const visImgs    = showAll ? allImgs : allImgs.slice(0, BATCH);
  const hiddenCnt  = allImgs.length - BATCH;
  const hasMilestones = weekData.milestones?.length  > 0;
  const hasArtist     = weekData.artistTweets?.length > 0;
  const hasHighlights = weekData.highlights?.length  > 0;

  return (
    <div className={styles.weekContent}>
      {/* Week heading */}
      <div className={styles.weekContentHeader}>
        <span className={styles.weekContentMeta}>
          {weekData.count} images across{" "}
          {Object.keys(weekData.channels ?? {}).length} channel
          {Object.keys(weekData.channels ?? {}).length !== 1 ? "s" : ""}
        </span>
        <div className={styles.weekContentChips}>
          {Object.entries(weekData.channels ?? {})
            .sort((a, b) => b[1] - a[1])
            .map(([ch, n]) => {
              const col = channelColors[ch] || "#888";
              return (
                <span
                  key={ch}
                  className={styles.weekContentChip}
                  style={{ color: col, borderColor: `${col}44`, background: `${col}11` }}
                >
                  {ch} · {n}
                </span>
              );
            })}
        </div>
      </div>

      {/* ── Official milestones */}
      {hasMilestones && (
        <div className={styles.tweetSection}>
          <div className={`${styles.tweetSectionLabel} ${styles.labelMilestone}`}>
            ★ official milestone
          </div>
          <div className={styles.embedGrid}>
            {weekData.milestones.map((m, i) => (
              <TweetEmbed key={i} url={m.url} />
            ))}
          </div>
        </div>
      )}

      {/* ── Artist work */}
      {hasArtist && (
        <div className={styles.tweetSection}>
          <div className={`${styles.tweetSectionLabel} ${styles.labelArtist}`}>
            🎨 artist work
          </div>
          <div className={styles.embedGrid}>
            {weekData.artistTweets.map((a, i) => (
              <TweetEmbed key={i} url={a.url} />
            ))}
          </div>
        </div>
      )}

      {/* ── Community highlights */}
      {hasHighlights && (
        <div className={styles.tweetSection}>
          <div className={`${styles.tweetSectionLabel} ${styles.labelHighlight}`}>
            💬 community highlight
          </div>
          <div className={styles.embedGrid}>
            {weekData.highlights.map((h, i) => (
              <TweetEmbed key={i} url={h.url} />
            ))}
          </div>
        </div>
      )}

      {/* ── Community tweets (memes) */}
      {weekData.commTweets?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className={styles.commLabel}>
            <span className={styles.commDot} />
            {weekData.commTweets.length} community tweet{weekData.commTweets.length !== 1 ? "s" : ""}
          </div>
          <div className={styles.imgGrid}>
            {weekData.commTweets.map((ct, i) => (
              <div
                key={i}
                className={`${styles.imgCard} ${styles.commCard}`}
                onClick={() => onImageClick(imgUrl(ct.file))}
              >
                <img src={imgUrl(ct.file)} alt={`@${ct.username}`} loading="lazy" />
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

      {/* ── Discord image grid */}
      {allImgs.length > 0 && (
        <>
          <div className={styles.imgGrid}>
            {visImgs.map((img, i) => {
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
                    onError={(e) => { e.currentTarget.closest("." + styles.imgCard).style.display = "none"; }}
                  />
                  <span className={styles.chDot} style={{ background: col }} />
                </div>
              );
            })}
          </div>
          {!showAll && hiddenCnt > 0 && (
            <button
              className={styles.showMore}
              onClick={() => setShowAll(true)}
            >
              + {hiddenCnt} more images
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Chronicle component ──────────────────────────────────────────────────
export default function MidevilsChronicle() {
  const [summary,      setSummary]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedIdx,  setSelectedIdx]  = useState(-1);
  const [lightboxSrc,  setLightboxSrc]  = useState(null);

  // Load Twitter widget script once
  useEffect(() => {
    if (document.querySelector('script[src*="platform.twitter.com"]')) return;
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.charset = "utf-8";
    document.body.appendChild(s);
  }, []);

  // Fetch summary on mount
  useEffect(() => {
    fetch("/api/midevils/timeline")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setSummary(d);
        setLoading(false);
        if (d.weeks?.length) {
          const lastIdx = d.weeks.length - 1;
          setSelectedIdx(lastIdx);
          setSelectedWeek(d.weeks[lastIdx].week);
        }
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const selectWeek = useCallback((idx) => {
    if (!summary?.weeks || idx < 0 || idx >= summary.weeks.length) return;
    setSelectedIdx(idx);
    setSelectedWeek(summary.weeks[idx].week);
    // Scroll to top of content on navigation
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [summary]);

  const handleBarClick = useCallback((idx) => {
    if (!summary?.weeks) return;
    setSelectedIdx(idx);
    setSelectedWeek(summary.weeks[idx].week);
  }, [summary]);

  const handlePrev = useCallback(() => selectWeek(selectedIdx - 1), [selectWeek, selectedIdx]);
  const handleNext = useCallback(() => selectWeek(selectedIdx + 1), [selectWeek, selectedIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape")     setLightboxSrc(null);
      if (e.key === "ArrowLeft"  && !lightboxSrc) handlePrev();
      if (e.key === "ArrowRight" && !lightboxSrc) handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePrev, handleNext, lightboxSrc]);

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
          {summary && (
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={styles.statN}>{summary.totalImages?.toLocaleString()}</div>
                <div className={styles.statL}>Community Moments</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statN}>{summary.weeks?.length}</div>
                <div className={styles.statL}>Active Weeks</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statN}>{summary.totalMilestones ?? 0}</div>
                <div className={styles.statL}>Milestone Tweets</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statN}>{summary.totalArtist ?? 0}</div>
                <div className={styles.statL}>Artist Posts</div>
              </div>
            </div>
          )}
        </div>

        {/* Loading / error */}
        {loading && (
          <div style={{ padding: "40px 36px", textAlign: "center", color: "#888" }}>
            <div className={styles.weekContentSpinner} style={{ margin: "0 auto 16px" }} />
            Loading chronicle…
          </div>
        )}
        {error && (
          <div style={{ padding: "80px 36px", textAlign: "center", color: "#fc5c5c" }}>
            Failed to load: {error}
          </div>
        )}

        {summary && (
          <>
            {/* Pulse graph — sticky */}
            <div className={styles.pulseSection}>
              <div className={styles.pulseHeader}>
                <span className={styles.pulseLabel}>Community Activity Pulse</span>
                <div className={styles.pulseLegend}>
                  {[
                    ["#7c5cfc", "Milestone"],
                    ["#c8832a", "High activity"],
                    ["#999",    "Active"],
                    ["#d0d0d0", "Quiet"],
                  ].map(([color, label]) => (
                    <span key={label} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <PulseGraph
                weeks={summary.weeks}
                maxScore={summary.maxScore}
                selectedIdx={selectedIdx}
                onBarClick={handleBarClick}
              />
              <div className={styles.pulseFooter}>
                <span className={styles.pulseDate}>{summary.weeks[0]?.weekLabel ?? ""}</span>
                <span className={styles.pulseHint}>Click any bar to view that week</span>
                <span className={styles.pulseDate}>{summary.weeks[summary.weeks.length - 1]?.weekLabel ?? ""}</span>
              </div>
            </div>

            {/* Week navigator */}
            <div className={styles.weekNav}>
              <button
                className={styles.weekNavArrow}
                onClick={handlePrev}
                disabled={selectedIdx <= 0}
                aria-label="Previous week"
              >
                ←
              </button>
              <div className={styles.weekNavInfo}>
                <span className={styles.weekNavLabel}>
                  {summary.weeks[selectedIdx]?.weekLabel ?? ""}
                </span>
                <span className={styles.weekNavCounter}>
                  week {selectedIdx + 1} of {summary.weeks.length}
                </span>
              </div>
              <button
                className={styles.weekNavArrow}
                onClick={handleNext}
                disabled={selectedIdx >= summary.weeks.length - 1}
                aria-label="Next week"
              >
                →
              </button>
            </div>

            {/* Full-width week content */}
            {selectedWeek && (
              <WeekContent
                key={selectedWeek}
                weekKey={selectedWeek}
                channelColors={summary.channelColors}
                onImageClick={setLightboxSrc}
              />
            )}
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
