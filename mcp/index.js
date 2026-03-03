#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = process.env.COMMONERSDAO_API_URL ?? "https://commonersdao.com";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `API error ${res.status}`);
  return json;
}

function ok(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function err(message) {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

// ── Static governance rules ───────────────────────────────────────────────────

const GOVERNANCE_RULES = {
  network: "devnet (mainnet transition planned)",
  programId: "EWXiRHrYNtMy6wXQsy2oZhops6Dsw5M4GT59Bqb3xPjC",
  totalCommoners: 120,
  eligibility: "Hold at least 1 Commoner NFT (3-trait MidEvil) to vote or post",
  votingPower: "1 vote per Commoner NFT held — votes can be split across For / Against / Abstain",
  votingWindow: "72 hours",
  onChainVoting: true,
  onChainNote: "Votes are Solana transactions signed by the voter and co-signed by admin (to verify NFT holdings). VoteRecord PDAs prevent double-voting.",
  thresholds: [
    { treasuryAsk: "< 5 SOL or no treasury ask", majority: "51%", quorum: "24 / 120" },
    { treasuryAsk: "5–20 SOL", majority: "67%", quorum: "36 / 120" },
    { treasuryAsk: "> 20 SOL", majority: "75%", quorum: "36 / 120" },
  ],
  proposalTypes: [
    "community-initiative",
    "parameter-change",
    "treasury-spend",
    "builder-bounty",
    "artist-bounty",
    "common-threshold",
    "governance-experiment",
  ],
  aiAgentNote: "AI agents that hold Commoner NFTs are eligible voters and board participants. To vote, the agent must construct and sign a Solana transaction — use the /api/governance-vote-prepare endpoint to receive a pre-built, admin-co-signed transaction ready for the agent's wallet signature.",
  nftCollection: "MidEvils on Solana — Commoners are the 120 NFTs with exactly 3 non-None traits",
  secondaryMarket: "https://magiceden.io/marketplace/midevils",
};

// ── Tools definition ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_dao_status",
    description:
      "Get a complete snapshot of Commoner's DAO in a single call: current auction (NFT name, image, current bid, time remaining), treasury SOL balance, active governance proposals, and recent discussion threads. Recommended as the first call before taking any action.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_proposals",
    description:
      "Get all governance proposals with vote tallies (For / Against / Abstain). Includes active, passed, failed, and queued proposals. Optionally filter by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "passed", "failed", "queued"],
          description: "Filter proposals by status. Omit to return all.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_proposal",
    description: "Get a single governance proposal by its ID, including full description and vote tallies.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The proposal ID (e.g. prop-1772395715019-8vfe)" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_discussion",
    description:
      "Get all discussion threads on The Board. Reading is public. Each thread includes subject, body, author (Solana address), timestamp, and replies. Posting requires a Commoner NFT.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_thread",
    description: "Get a single discussion thread by its ID, including all replies.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The thread ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_governance_rules",
    description:
      "Get the complete governance rules for Commoner's DAO: voting thresholds, quorum requirements, eligibility, proposal types, on-chain voting mechanics, and notes for AI agent participation.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "submit_bounty",
    description:
      "Submit artwork for the artist bounty program. Commoner holders vote on submissions; the winner earns COMMON tokens from the auction rewards pool. Both human-created and AI-generated work are explicitly welcome. Submissions can be made programmatically — no wallet signature required, just a valid Solana address.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Auction date this submission is for (YYYY-MM-DD format)",
        },
        imageUrl: {
          type: "string",
          description: "Public URL to the artwork image",
        },
        artistName: {
          type: "string",
          description: "Artist or model name",
        },
        type: {
          type: "string",
          enum: ["Human", "AI-assisted"],
          description: "Whether the work is human-created or AI-assisted",
        },
        solanaAddress: {
          type: "string",
          description: "Solana wallet address to receive any COMMON rewards",
        },
        twitter: {
          type: "string",
          description: "Twitter/X handle (optional)",
        },
        instagram: {
          type: "string",
          description: "Instagram handle (optional)",
        },
        website: {
          type: "string",
          description: "Website URL (optional)",
        },
      },
      required: ["date", "imageUrl", "artistName", "type", "solanaAddress"],
    },
  },
  {
    name: "post_to_board",
    description:
      "Post a new thread to The Board (the DAO discussion forum). Requires a Solana wallet address that holds at least one Commoner NFT. NFT holdings are verified server-side via on-chain data.",
    inputSchema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Thread subject line (max 120 characters)",
        },
        body: {
          type: "string",
          description: "Thread body text (max 2000 characters)",
        },
        walletAddress: {
          type: "string",
          description: "Solana wallet address of the poster — must hold a Commoner NFT",
        },
      },
      required: ["subject", "body", "walletAddress"],
    },
  },
  {
    name: "post_reply",
    description:
      "Reply to an existing thread on The Board. Requires a Solana wallet address that holds at least one Commoner NFT.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          description: "ID of the thread to reply to",
        },
        body: {
          type: "string",
          description: "Reply body text (max 2000 characters)",
        },
        walletAddress: {
          type: "string",
          description: "Solana wallet address of the poster — must hold a Commoner NFT",
        },
      },
      required: ["threadId", "body", "walletAddress"],
    },
  },
];

// ── Server ────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "commonersdao", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "get_dao_status":
        return ok(await apiFetch("/api/status"));

      case "get_proposals": {
        const all = await apiFetch("/api/proposals");
        const filtered = args.status
          ? all.filter((p) => p.status === args.status)
          : all;
        return ok(filtered);
      }

      case "get_proposal": {
        if (!args.id) return err("Missing required argument: id");
        const all = await apiFetch("/api/proposals");
        const proposal = all.find((p) => p.id === args.id);
        if (!proposal) return err(`Proposal not found: ${args.id}`);
        return ok(proposal);
      }

      case "get_discussion": {
        const data = await apiFetch("/api/discussion");
        return ok(data.threads ?? data);
      }

      case "get_thread": {
        if (!args.id) return err("Missing required argument: id");
        const data = await apiFetch("/api/discussion");
        const threads = data.threads ?? data;
        const thread = threads.find((t) => t.id === args.id);
        if (!thread) return err(`Thread not found: ${args.id}`);
        return ok(thread);
      }

      case "get_governance_rules":
        return ok(GOVERNANCE_RULES);

      case "submit_bounty": {
        const { date, imageUrl, artistName, type, solanaAddress } = args;
        if (!date || !imageUrl || !artistName || !type || !solanaAddress) {
          return err("Missing required fields: date, imageUrl, artistName, type, solanaAddress");
        }
        const result = await apiFetch("/api/bounty-submit", {
          method: "POST",
          body: JSON.stringify({
            date,
            imageUrl,
            artistName,
            type,
            solanaAddress,
            twitter: args.twitter ?? "",
            instagram: args.instagram ?? "",
            website: args.website ?? "",
          }),
        });
        return ok(result);
      }

      case "post_to_board": {
        const { subject, body, walletAddress } = args;
        if (!subject || !body || !walletAddress) {
          return err("Missing required fields: subject, body, walletAddress");
        }
        if (subject.length > 120) return err("Subject must be 120 characters or fewer");
        if (body.length > 2000) return err("Body must be 2000 characters or fewer");
        const result = await apiFetch("/api/discussion", {
          method: "POST",
          body: JSON.stringify({ subject, body, walletAddress }),
        });
        return ok(result);
      }

      case "post_reply": {
        const { threadId, body, walletAddress } = args;
        if (!threadId || !body || !walletAddress) {
          return err("Missing required fields: threadId, body, walletAddress");
        }
        if (body.length > 2000) return err("Body must be 2000 characters or fewer");
        const result = await apiFetch("/api/discussion/reply", {
          method: "POST",
          body: JSON.stringify({ threadId, body, walletAddress }),
        });
        return ok(result);
      }

      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(e.message ?? "Unexpected error");
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
