import { NextResponse } from "next/server";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BorshAccountsCoder } from "@coral-xyz/anchor";
import idl from "../../../lib/idl.json";
import {
  getConnection,
  configPDA,
  fetchActiveAuctions,
  fetchMetadataBatch,
  RPC_URL,
} from "../../../lib/programClient";
import { getFile } from "../../../lib/githubApi";

const IS_DEVNET = !RPC_URL.includes("mainnet");

async function fetchTreasury(connection) {
  const [cfgPda] = configPDA();
  const cfgInfo = await connection.getAccountInfo(cfgPda);
  if (!cfgInfo) return null;
  const coder = new BorshAccountsCoder(idl);
  const cfg = coder.decode("ProgramConfig", cfgInfo.data);
  const address = cfg.treasury.toBase58();
  const lamports = await connection.getBalance(new PublicKey(address));
  return { address, balanceSol: lamports / LAMPORTS_PER_SOL };
}

async function fetchCurrentAuction(connection) {
  const active = await fetchActiveAuctions(connection);
  if (!active.length) return null;

  // Pick the one with the latest start_time (most recent auction)
  active.sort((a, b) => b.state.start_time.toNumber() - a.state.start_time.toNumber());
  const { state } = active[0];

  const mint = state.nft_mint.toBase58();

  // Try Helius DAS first, fall back to auction schedule JSON for devnet mints
  const assets = await fetchMetadataBatch([mint]);
  const asset = assets[0];
  let nftName = asset?.content?.metadata?.name ?? null;
  let nftImage = asset?.content?.links?.image ?? asset?.content?.files?.[0]?.uri ?? null;

  if (!nftName || !nftImage) {
    const { content: schedule } = await getFile("data/auction-schedule.json").catch(() => ({ content: {} }));
    const entry = Object.values(schedule || {}).find((e) => e.nftId === mint);
    nftName = nftName ?? entry?.name ?? null;
    nftImage = nftImage ?? entry?.image ?? null;
  }

  return {
    auctionId: state.auction_id.toNumber(),
    nftMint: mint,
    nftName,
    nftImage,
    currentBidSol: state.current_bid.toNumber() / LAMPORTS_PER_SOL,
    reservePriceSol: state.reserve_price.toNumber() / LAMPORTS_PER_SOL,
    highestBidder: state.highest_bidder?.toBase58?.() ?? null,
    bidCount: state.bid_count,
    startTime: new Date(state.start_time.toNumber() * 1000).toISOString(),
    endTime: new Date(state.end_time.toNumber() * 1000).toISOString(),
    settled: state.settled,
  };
}

async function fetchProposals() {
  const [{ content: proposals }, { content: votes }] = await Promise.all([
    getFile("data/proposals.json"),
    getFile("data/governance-votes.json").catch(() => ({ content: {} })),
  ]);
  return (proposals || [])
    .filter((p) => p.status === "active")
    .map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      status: p.status,
      endsAt: p.endsAt,
      votes: votes?.[p.id]?.tallies ?? p.votes ?? { yes: 0, no: 0, abstain: 0 },
    }));
}

async function fetchRecentThreads() {
  const { content } = await getFile("data/discussion.json");
  return (content?.threads || []).slice(0, 5).map((t) => ({
    id: t.id,
    subject: t.subject,
    author: t.author,
    timestamp: t.timestamp,
    replyCount: (t.replies || []).length,
  }));
}

export async function GET() {
  const connection = getConnection();

  const [treasuryResult, auctionResult, proposalsResult, threadsResult] =
    await Promise.allSettled([
      fetchTreasury(connection),
      fetchCurrentAuction(connection),
      fetchProposals(),
      fetchRecentThreads(),
    ]);

  const status = {
    network: IS_DEVNET ? "devnet" : "mainnet",
    fetchedAt: new Date().toISOString(),
    treasury: treasuryResult.status === "fulfilled" ? treasuryResult.value : null,
    auction: auctionResult.status === "fulfilled" ? auctionResult.value : null,
    activeProposals: proposalsResult.status === "fulfilled" ? proposalsResult.value : [],
    recentThreads: threadsResult.status === "fulfilled" ? threadsResult.value : [],
    links: {
      home: "https://commonersdao.com",
      bounty: "https://commonersdao.com/bounty",
      governance: "https://commonersdao.com/governance",
      discussion: "https://commonersdao.com/discussion",
      treasury: "https://commonersdao.com/treasury",
      holders: "https://commonersdao.com/holders",
      magicEden: "https://magiceden.io/marketplace/midevils",
    },
  };

  return NextResponse.json(status, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
