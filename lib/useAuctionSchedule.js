"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { fetchSlotAccounts, fetchMetadataBatch } from "./programClient";
import schedule from "../data/auction-schedule.json";

const CACHE_KEY = "auction_slots_v1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// mint → static schedule entry for JSON fallback
const mintToSchedule = {};
for (const [dateStr, entry] of Object.entries(schedule)) {
  mintToSchedule[entry.nftId] = { dateStr, ...entry };
}

export function useAuctionSchedule() {
  const { connection } = useConnection();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (conn, skipCache = false) => {
      if (!skipCache) {
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const { ts, data } = JSON.parse(cached);
            if (Date.now() - ts < CACHE_TTL) {
              setSlots(data);
              setLoading(false);
              return;
            }
          }
        } catch (_) {}
      }

      try {
        const slotAccounts = await fetchSlotAccounts(conn);
        const mints = slotAccounts.map((s) => s.nftMint);
        const dasAssets = mints.length ? await fetchMetadataBatch(mints) : [];

        const dasMap = {};
        for (const asset of dasAssets) {
          if (asset?.id) dasMap[asset.id] = asset;
        }

        const result = slotAccounts.map((slot) => {
          const das = dasMap[slot.nftMint];
          const fallback = mintToSchedule[slot.nftMint];

          let name = "Commoner";
          let image = null;
          let traits = [];

          if (das) {
            name = das.content?.metadata?.name || das.id;
            image =
              das.content?.links?.image || das.content?.json_uri || null;
            traits = (das.content?.metadata?.attributes || []).map(
              (a) => a.value
            );
          } else if (fallback) {
            name = fallback.name;
            image = fallback.image;
            traits = fallback.traits;
          }

          return {
            dateStr: slot.dateStr,
            nftMint: slot.nftMint,
            name,
            image,
            traits,
            seller: slot.owner,
            escrowed: slot.escrowed,
            consumed: slot.consumed,
            pubkey: slot.pubkey,
          };
        });

        // Include JSON entries that have no on-chain slot yet
        const onChainMints = new Set(slotAccounts.map((s) => s.nftMint));
        for (const [dateStr, entry] of Object.entries(schedule)) {
          if (!onChainMints.has(entry.nftId)) {
            result.push({
              dateStr,
              nftMint: entry.nftId,
              name: entry.name,
              image: entry.image,
              traits: entry.traits,
              seller: entry.seller,
              escrowed: false,
              consumed: false,
              pubkey: null,
            });
          }
        }

        result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data: result })
          );
        } catch (_) {}

        setSlots(result);
      } catch (e) {
        console.error("Failed to fetch slot accounts:", e);
        // Full fallback to static JSON
        const fallback = Object.entries(schedule)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dateStr, entry]) => ({
            dateStr,
            nftMint: entry.nftId,
            name: entry.name,
            image: entry.image,
            traits: entry.traits,
            seller: entry.seller,
            escrowed: false,
            consumed: false,
            pubkey: null,
          }));
        setSlots(fallback);
      } finally {
        setLoading(false);
      }
    },
    [connection]
  );

  useEffect(() => {
    if (connection) load(connection);
  }, [connection, load]);

  function invalidate() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (_) {}
    if (connection) load(connection, true);
  }

  return { slots, loading, invalidate };
}
