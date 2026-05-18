"use client";

// PostBody — renders a Board post body, parsing standalone URLs into
// inline embeds. The Tier 1 trick that lets posts feel image-rich without
// the site hosting any uploaded bytes.
//
// Rules:
//   * A line that is exactly a tweet URL  → inline X embed (lazy-loaded).
//   * A line that is exactly an image URL → inline <img>.
//   * A line containing URLs but other text → autolinked text.
//   * Plain text passes through with whitespace preserved.
//
// All embeds are external-source. We never hotlink content from origins
// that don't already serve them publicly. URL patterns are strict to
// avoid any HTML-injection or unexpected fetch surface.

import { useEffect, useRef } from "react";

const TWEET_RE =
  /^https?:\/\/(?:(?:www|mobile)\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)(?:[/?#].*)?$/i;

// Hosts whose image URLs we'll inline directly.
const IMAGE_HOSTS = [
  /^https?:\/\/pbs\.twimg\.com\/media\//i,
  /^https?:\/\/i\.imgur\.com\//i,
  /^https?:\/\/cdn\.discordapp\.com\/attachments\//i,
  /^https?:\/\/media\.discordapp\.net\/attachments\//i,
];

// Or any URL whose path ends with a known image extension (after stripping
// query and fragment).
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif)(?:[?#]|$)/i;

// Inline URL detection for autolinking text that isn't itself a single URL.
const INLINE_URL_RE = /(https?:\/\/[^\s<>"]+)/g;

function isTweetUrl(s) {
  return TWEET_RE.test(s);
}

function isImageUrl(s) {
  if (!/^https?:\/\//i.test(s)) return false;
  if (IMAGE_HOSTS.some((re) => re.test(s))) return true;
  return IMAGE_EXT_RE.test(s);
}

function tweetIdFromUrl(s) {
  const m = s.match(TWEET_RE);
  return m ? m[2] : null;
}

// Renders a single tweet embed, lazy-loaded when the surrounding container
// scrolls into view. Mirrors the IntersectionObserver pattern used on the
// /midevils page so we don't load Twitter's iframe machinery for every
// post on the thread list.
function TweetEmbed({ url }) {
  const ref = useRef(null);
  const loadedRef = useRef(false);
  const tweetId = tweetIdFromUrl(url);

  useEffect(() => {
    if (!ref.current || !tweetId) return;
    const container = ref.current;
    loadedRef.current = false;

    const create = () => {
      if (loadedRef.current) return;
      loadedRef.current = true;
      const tryCreate = () => {
        if (window.twttr?.widgets?.createTweet) {
          container.innerHTML = "";
          window.twttr.widgets.createTweet(tweetId, container, {
            theme: "light",
            dnt: true,
            conversation: "none",
          });
        } else {
          setTimeout(tryCreate, 300);
        }
      };
      tryCreate();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          create();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [tweetId]);

  if (!tweetId) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-foreground underline hover:text-gold"
      >
        {url}
      </a>
    );
  }

  return (
    <div className="my-3">
      <div ref={ref} className="empty:before:content-['Loading_tweet…'] empty:before:text-xs empty:before:text-muted" />
    </div>
  );
}

// Renders a line of plain text with inline URL autolinking.
function AutolinkedText({ text }) {
  const parts = [];
  let lastIndex = 0;
  let match;
  // Use a fresh RegExp instance to avoid lastIndex sharing issues.
  const re = new RegExp(INLINE_URL_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`url-${match.index}`}
        href={match[1]}
        target="_blank"
        rel="noreferrer"
        className="text-foreground underline underline-offset-2 hover:text-gold break-all"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[1].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

export default function PostBody({ body, className = "" }) {
  if (!body) return null;
  const lines = body.split(/\r?\n/);

  // Group consecutive plain-text lines into paragraphs to preserve
  // whitespace without rendering empty <p> tags everywhere. Embeds and
  // images are block-level and break paragraphs naturally.
  const blocks = [];
  let textBuffer = [];

  function flushText() {
    if (textBuffer.length === 0) return;
    blocks.push({ type: "text", lines: textBuffer });
    textBuffer = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line && isTweetUrl(line)) {
      flushText();
      blocks.push({ type: "tweet", url: line });
    } else if (line && isImageUrl(line)) {
      flushText();
      blocks.push({ type: "image", url: line });
    } else {
      textBuffer.push(raw);
    }
  }
  flushText();

  return (
    <div className={`text-sm text-foreground leading-relaxed space-y-3 ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === "tweet") {
          return <TweetEmbed key={i} url={block.url} />;
        }
        if (block.type === "image") {
          return (
            <a
              key={i}
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="block my-2"
            >
              <img
                src={block.url}
                alt=""
                className="max-w-full max-h-[480px] object-contain border border-border bg-card"
                loading="lazy"
              />
            </a>
          );
        }
        // Text block — render as <p> with autolinks; preserve newlines.
        return (
          <p key={i} className="whitespace-pre-wrap">
            {block.lines.map((ln, j) => (
              <span key={j}>
                <AutolinkedText text={ln} />
                {j < block.lines.length - 1 ? "\n" : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// Twitter widget loader — drop this once near the top of any page that
// uses PostBody so the embed JS loads exactly once. Subsequent embeds
// just call window.twttr.widgets.createTweet.
export function TweetWidgetScript() {
  return (
    <script
      async
      defer
      src="https://platform.twitter.com/widgets.js"
    />
  );
}
