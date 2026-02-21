import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../lib/githubApi";
import { getCommonerCount } from "../../../lib/commoners";

export async function POST(request) {
  try {
    const { type, title, description, treasurySol, walletAddress } =
      await request.json();

    if (!type || !title || !description || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Must hold a Commoner NFT to submit a proposal
    const commonerCount = await getCommonerCount(walletAddress);
    if (commonerCount === 0) {
      return NextResponse.json(
        { error: "You must hold a Commoner NFT to submit a proposal." },
        { status: 403 }
      );
    }

    const id = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const solAmount = parseFloat(treasurySol) || 0;
    const proposal = {
      id,
      type,
      title,
      description,
      treasurySol: solAmount,
      proposedBy: walletAddress,
      submittedAt: new Date().toISOString(),
    };

    // Save to pending-proposals.json via GitHub API
    try {
      const { content, sha } = await getFile("data/pending-proposals.json");
      const updated = [...(content || []), proposal];
      await putFile(
        "data/pending-proposals.json",
        updated,
        sha,
        `governance: new proposal from ${walletAddress.slice(0, 8)}… — "${title}"`
      );
    } catch (ghErr) {
      console.error("GitHub write failed:", ghErr.message);
    }

    // Discord notification — uses dedicated governance channel if configured
    const webhookUrl =
      process.env.DISCORD_GOVERNANCE_WEBHOOK_URL ||
      process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      const embed = {
        title: `New Governance Proposal — ${title}`,
        color: 0x1a1a1a,
        fields: [
          { name: "Type", value: type, inline: true },
          {
            name: "Treasury Ask",
            value: solAmount > 0 ? `${solAmount} SOL` : "None",
            inline: true,
          },
          {
            name: "Proposer",
            value: `\`${walletAddress}\``,
            inline: false,
          },
          {
            name: "Description",
            value: description.slice(0, 1024),
            inline: false,
          },
          { name: "Proposal ID", value: `\`${id}\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
      };
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed] }),
        });
      } catch (discordErr) {
        console.error("Discord webhook failed:", discordErr.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("governance-submit error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
