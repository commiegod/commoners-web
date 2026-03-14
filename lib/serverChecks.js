/**
 * Server-only cached wrappers for Helius DAS holder checks.
 *
 * Import these in API routes instead of the raw lib functions.
 * The client-compatible originals in midevils.js / commoners.js remain
 * unchanged for use in client components.
 *
 * Cache TTL: 5 minutes per wallet address.
 * Uses Next.js Data Cache (shared across warm instances in a region).
 */
import { unstable_cache } from "next/cache";
import { getMidEvilCount as _getMidEvilCount } from "./midevils.js";
import { getCommonerCount as _getCommonerCount } from "./commoners.js";

export const getMidEvilCount = unstable_cache(
  (walletAddress) => _getMidEvilCount(walletAddress),
  ["midevil-count"],
  { revalidate: 300 }
);

export const getCommonerCount = unstable_cache(
  (walletAddress) => _getCommonerCount(walletAddress),
  ["commoner-count"],
  { revalidate: 300 }
);
