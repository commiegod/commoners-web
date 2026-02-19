"use client";

import { useState, useMemo } from "react";
import commoners from "../../data/commoners.json";

function getAllTraitValues(traitType) {
  const values = new Set();
  commoners.nfts.forEach((nft) => {
    nft.traits.forEach((t) => {
      if (t.trait_type === traitType) values.add(t.value);
    });
  });
  return Array.from(values).sort();
}

const traitTypes = ["Background", "Skin", "Clothing", "Eyewear"];

export default function GalleryPage() {
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");

  const traitOptions = useMemo(() => {
    const options = {};
    traitTypes.forEach((type) => {
      const values = getAllTraitValues(type);
      if (values.length > 0) options[type] = values;
    });
    return options;
  }, []);

  const filtered = useMemo(() => {
    return commoners.nfts.filter((nft) => {
      if (search && !nft.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      for (const [traitType, value] of Object.entries(filters)) {
        if (!value) continue;
        const hasTrait = nft.traits.some(
          (t) => t.trait_type === traitType && t.value === value
        );
        if (!hasTrait) return false;
      }
      return true;
    });
  }, [filters, search]);

  return (
    <div>
      <h1 className="font-blackletter text-3xl text-gold mb-6">Gallery</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-card border border-border text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
        />
        {Object.entries(traitOptions).map(([type, values]) => (
          <select
            key={type}
            value={filters[type] || ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, [type]: e.target.value || undefined }))
            }
            className="px-3 py-1.5 bg-card border border-border text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">{type}</option>
            {values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
        {Object.keys(filters).length > 0 && (
          <button
            onClick={() => setFilters({})}
            className="px-3 py-1.5 text-sm text-gold hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="text-sm text-muted mb-4">
        Showing {filtered.length} of {commoners.totalCommoners} Commoners
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filtered.map((nft) => (
          <div
            key={nft.id}
            className="bg-card border border-border overflow-hidden group"
          >
            <img
              src={nft.image}
              alt={nft.name}
              className="w-full aspect-square object-cover"
              loading="lazy"
            />
            <div className="p-2">
              <p className="text-sm font-medium truncate">{nft.name}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {nft.traits.map((t) => (
                  <span
                    key={t.trait_type}
                    className="text-[10px] px-1.5 py-0.5 bg-gold/10 border border-gold/20 text-gold/80"
                  >
                    {t.value}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
