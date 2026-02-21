import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, imageUrl, artistName, type } = body;

    if (!date || !imageUrl || !artistName || !type) {
      return NextResponse.json(
        { error: "Missing required fields: date, imageUrl, artistName, type" },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    const socialLines = [];
    if (body.twitter)
      socialLines.push(`**X / Twitter:** ${body.twitter}`);
    if (body.instagram)
      socialLines.push(`**Instagram:** ${body.instagram}`);
    if (body.website)
      socialLines.push(`**Website:** ${body.website}`);

    const embed = {
      title: `New Bounty Submission — ${date}`,
      color: 0x1a1a1a,
      fields: [
        { name: "Artist / Model", value: artistName, inline: true },
        { name: "Type", value: type, inline: true },
        { name: "Date", value: date, inline: true },
        ...(socialLines.length
          ? [{ name: "Links", value: socialLines.join("\n"), inline: false }]
          : []),
      ],
      image: { url: imageUrl },
      timestamp: new Date().toISOString(),
    };

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordRes.ok) {
      const text = await discordRes.text();
      console.error("Discord webhook error:", text);
      return NextResponse.json(
        { error: "Failed to send to Discord" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("bounty-submit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
