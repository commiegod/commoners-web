import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../lib/githubApi";
import { getCommonerCount } from "../../../lib/commoners";
import { verifyWalletSignature } from "../../../lib/verifyWalletSignature";

const FILE = "data/discussion.json";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function GET() {
  try {
    const { content } = await getFile(FILE);
    return NextResponse.json(content || { threads: [] });
  } catch {
    return NextResponse.json({ threads: [] });
  }
}

export async function POST(request) {
  try {
    const { subject, body, walletAddress, signature, signedMessage } = await request.json();

    if (!subject?.trim() || !body?.trim() || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (subject.trim().length > 120) {
      return NextResponse.json({ error: "Subject too long (max 120 chars)." }, { status: 400 });
    }
    if (body.trim().length > 2000) {
      return NextResponse.json({ error: "Body too long (max 2000 chars)." }, { status: 400 });
    }

    if (!signature || !signedMessage) {
      return NextResponse.json({ error: "Wallet signature required." }, { status: 400 });
    }
    const sigResult = verifyWalletSignature(walletAddress, signedMessage, signature);
    if (!sigResult.ok) {
      return NextResponse.json({ error: sigResult.reason }, { status: 403 });
    }

    const count = await getCommonerCount(walletAddress);
    if (count === 0) {
      return NextResponse.json(
        { error: "You must hold a Commoner NFT to post." },
        { status: 403 }
      );
    }

    const { content, sha } = await getFile(FILE);
    const data = content || { threads: [] };

    const thread = {
      id: makeId(),
      subject: subject.trim(),
      body: body.trim(),
      author: walletAddress,
      timestamp: Date.now(),
      replies: [],
    };

    data.threads.unshift(thread);

    await putFile(
      FILE,
      data,
      sha,
      `discussion: new thread by ${walletAddress.slice(0, 8)}…`
    );

    return NextResponse.json({ ok: true, thread });
  } catch (err) {
    console.error("discussion POST error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { threadId } = await request.json();
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId." }, { status: 400 });
    }

    const { content, sha } = await getFile(FILE);
    const data = content || { threads: [] };

    data.threads = data.threads.filter((t) => t.id !== threadId);

    await putFile(FILE, data, sha, `discussion: admin deleted thread ${threadId}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("discussion DELETE error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
