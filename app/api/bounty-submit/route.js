import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../lib/githubApi";

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, imageUrl, artistName, type, solanaAddress, turnstileToken } = body;

    if (!date || !imageUrl || !artistName || !type || !solanaAddress) {
      return NextResponse.json(
        { error: "Missing required fields: date, imageUrl, artistName, type, solanaAddress" },
        { status: 400 }
      );
    }

    // ── Turnstile verification (skipped if secret not configured) ─────────────
    if (process.env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return NextResponse.json(
          { error: "Please complete the captcha." },
          { status: 400 }
        );
      }
      const verify = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken,
          }),
        }
      );
      const verifyData = await verify.json();
      if (!verifyData.success) {
        return NextResponse.json(
          { error: "Captcha verification failed. Please try again." },
          { status: 400 }
        );
      }
    }

    // ── 1. Write to pending-bounties.json via GitHub API ──────────────────────
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const submission = {
      id,
      date,
      imageUrl,
      artistName,
      type,
      solanaAddress,
      twitter: body.twitter || "",
      instagram: body.instagram || "",
      website: body.website || "",
      submittedAt: new Date().toISOString(),
    };

    try {
      const { content: existing, sha } = await getFile("data/pending-bounties.json");
      const updated = [...(existing || []), submission];
      await putFile(
        "data/pending-bounties.json",
        updated,
        sha,
        `bounty: new submission from ${artistName} for ${date}`
      );
    } catch (ghErr) {
      // Non-fatal — Discord notification still goes through
      console.error("GitHub write failed:", ghErr.message);
    }

    // ── 2. Discord webhook notification ───────────────────────────────────────
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      const socialLines = [];
      if (body.twitter) socialLines.push(`**X / Twitter:** ${body.twitter}`);
      if (body.instagram) socialLines.push(`**Instagram:** ${body.instagram}`);
      if (body.website) socialLines.push(`**Website:** ${body.website}`);

      const embed = {
        title: `New Bounty Submission — ${date}`,
        color: 0x1a1a1a,
        fields: [
          { name: "Artist / Model", value: artistName, inline: true },
          { name: "Type", value: type, inline: true },
          { name: "Date", value: date, inline: true },
          { name: "Solana Address", value: `\`${solanaAddress}\``, inline: false },
          ...(socialLines.length
            ? [{ name: "Links", value: socialLines.join("\n"), inline: false }]
            : []),
          { name: "Submission ID", value: `\`${id}\``, inline: false },
        ],
        image: { url: imageUrl },
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
    console.error("bounty-submit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
