"use client";

import { useState, useMemo } from "react";
import commoners from "../../data/commoners.json";
import rarityData from "../../data/rarity.json";

const RARITY = rarityData.rankings; // mint → { rank, score }

// Precompute trait type → sorted unique values
const TRAIT_MAP = {};
for (const nft of commoners.nfts) {
  for (const { trait_type, value } of nft.traits) {
    if (!TRAIT_MAP[trait_type]) TRAIT_MAP[trait_type] = new Set();
    TRAIT_MAP[trait_type].add(value);
  }
}
// Skip trait types with only one value (no filtering utility)
const FILTER_TYPES = Object.entries(TRAIT_MAP)
  .filter(([, v]) => v.size > 1)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k]) => k);
for (const t of FILTER_TYPES) TRAIT_MAP[t] = [...TRAIT_MAP[t]].sort();

function nftNumber(name) {
  return parseInt(name.match(/#(\d+)/)?.[1] ?? "0", 10);
}

function shortAddr(addr) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

export default function GalleryPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("number-asc");
  const [filters, setFilters] = useState({});
  const [selected, setSelected] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filtered = useMemo(() => {
    let list = [...commoners.nfts];

    // Trait filters
    for (const [type, val] of Object.entries(filters)) {
      if (!val) continue;
      list = list.filter((n) =>
        n.traits.some((t) => t.trait_type === type && t.value === val)
      );
    }

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.traits.some((t) => t.value.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sort === "number-asc") {
      list.sort((a, b) => nftNumber(a.name) - nftNumber(b.name));
    } else if (sort === "number-desc") {
      list.sort((a, b) => nftNumber(b.name) - nftNumber(a.name));
    } else if (sort === "rarity-asc") {
      list.sort((a, b) => (RARITY[a.id]?.rank ?? 999) - (RARITY[b.id]?.rank ?? 999));
    } else if (sort === "rarity-desc") {
      list.sort((a, b) => (RARITY[b.id]?.rank ?? 999) - (RARITY[a.id]?.rank ?? 999));
    }

    return list;
  }, [search, sort, filters]);

  function setFilter(type, val) {
    setFilters((f) => {
      const next = { ...f };
      if (val) next[type] = val;
      else delete next[type];
      return next;
    });
    setOpenDropdown(null);
  }

  function clearAll() {
    setFilters({});
    setSearch("");
    setSort("number-asc");
    setOpenDropdown(null);
  }

  // Navigate modal prev/next
  function navigate(dir) {
    if (!selected) return;
    const idx = filtered.indexOf(selected);
    const next = filtered[idx + dir];
    if (next) setSelected(next);
  }

  return (
    // Full-bleed breakout from layout's max-w-6xl padding
    <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)", marginTop: "-2rem" }}>

      {/* ── Sticky toolbar ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">

          {/* Search */}
          <input
            type="text"
            placeholder="Search name or trait…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-card border border-border text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none w-44"
          />

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-1.5 bg-card border border-border text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="number-asc">Number ↑</option>
            <option value="number-desc">Number ↓</option>
            <option value="rarity-asc">Rarity (rarest first)</option>
            <option value="rarity-desc">Rarity (common first)</option>
          </select>

          {/* Divider */}
          <span className="hidden sm:block w-px h-5 bg-border" />

          {/* Trait dropdowns */}
          {FILTER_TYPES.map((type) => {
            const active = filters[type];
            const isOpen = openDropdown === type;
            return (
              <div key={type} className="relative">
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border transition-colors whitespace-nowrap ${
                    active
                      ? "border-gold text-gold bg-gold/10"
                      : "border-border text-muted hover:text-foreground bg-card"
                  }`}
                >
                  {active || type}
                  <span className="text-[10px] opacity-60">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-background border border-border shadow-xl z-50 max-h-60 overflow-y-auto min-w-[160px]">
                    <button
                      onClick={() => setFilter(type, null)}
                      className="w-full text-left px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-card"
                    >
                      All
                    </button>
                    {TRAIT_MAP[type].map((val) => (
                      <button
                        key={val}
                        onClick={() => setFilter(type, val)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-card ${
                          active === val ? "text-gold" : "text-foreground"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Clear */}
          {(activeFilterCount > 0 || search || sort !== "number-asc") && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-sm text-gold hover:text-foreground border border-gold/30 hover:border-border transition-colors"
            >
              Clear all
            </button>
          )}

          {/* Count */}
          <span className="ml-auto text-sm text-muted">
            {filtered.length}
            <span className="hidden sm:inline"> / {commoners.totalCommoners} Commoners</span>
          </span>
        </div>
      </div>

      {/* Backdrop to close open dropdown */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setOpenDropdown(null)}
        />
      )}

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted">
          No Commoners match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {filtered.map((nft) => (
            <button
              key={nft.id}
              onClick={() => setSelected(nft)}
              className="group relative overflow-hidden bg-background aspect-square focus:outline-none"
            >
              <img
                src={nft.image}
                alt={nft.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {/* Always-visible name strip */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pt-8 pb-1.5">
                <p className="text-[11px] font-medium text-white/90 truncate leading-tight">
                  {nft.name}
                </p>
                {RARITY[nft.id] && (
                  <p className="text-[10px] text-gold/70 leading-tight">
                    #{RARITY[nft.id].rank} / 120
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative bg-background border border-border w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 z-10 text-muted hover:text-foreground bg-black/60 w-7 h-7 flex items-center justify-center text-sm"
            >
              ✕
            </button>

            {/* Prev / Next */}
            {filtered.indexOf(selected) > 0 && (
              <button
                onClick={() => navigate(-1)}
                className="absolute left-2 top-1/3 z-10 text-white/70 hover:text-white bg-black/50 w-7 h-7 flex items-center justify-center text-sm"
              >
                ‹
              </button>
            )}
            {filtered.indexOf(selected) < filtered.length - 1 && (
              <button
                onClick={() => navigate(1)}
                className="absolute right-2 top-1/3 z-10 text-white/70 hover:text-white bg-black/50 w-7 h-7 flex items-center justify-center text-sm"
              >
                ›
              </button>
            )}

            <img
              src={selected.image}
              alt={selected.name}
              className="w-full aspect-square object-cover"
            />

            <div className="p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-blackletter text-2xl text-gold">
                  {selected.name}
                </h2>
                {RARITY[selected.id] && (
                  <span className="text-xs text-gold/70 border border-gold/30 px-2 py-0.5">
                    #{RARITY[selected.id].rank} / 120
                  </span>
                )}
              </div>

              {/* Traits */}
              <div className="flex flex-wrap gap-2 mb-4">
                {selected.traits.map((t) => (
                  <button
                    key={t.trait_type}
                    onClick={() => {
                      setFilter(t.trait_type, t.value);
                      setSelected(null);
                    }}
                    title={`Filter by ${t.trait_type}: ${t.value}`}
                    className="bg-card border border-border px-3 py-1.5 text-left hover:border-gold/50 transition-colors"
                  >
                    <p className="text-[10px] text-muted uppercase tracking-wider">
                      {t.trait_type}
                    </p>
                    <p className="text-sm text-foreground">{t.value}</p>
                  </button>
                ))}
              </div>

              {/* Links */}
              <div className="border-t border-border pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Owner</span>
                  <a
                    href={`https://solscan.io/account/${selected.owner}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-foreground hover:text-gold transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shortAddr(selected.owner)} ↗
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Mint</span>
                  <a
                    href={`https://solscan.io/token/${selected.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-foreground hover:text-gold transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shortAddr(selected.id)} ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
