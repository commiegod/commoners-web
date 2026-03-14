import { NextResponse } from "next/server";
import { getFile, putFile } from "../../../../lib/githubApi";
import { getCommonerCount } from "../../../../lib/serverChecks";
import { verifyWalletSignature } from "../../../../lib/verifyWalletSignature";

const FILE = "data/discussion.json";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function makeId() {
  return crypto.randomUUID();
}

export async function POST(request) {
  try {
    const { threadId, body, walletAddress, signature, signedMessage } = await request.json();

    if (!threadId || !body?.trim() || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (body.trim().length > 2000) {
      return NextResponse.json({ error: "Reply too long (max 2000 chars)." }, { status: 400 });
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
        { error: "You must hold a Commoner NFT to reply." },
        { status: 403 }
      );
    }

    const { content, sha } = await getFile(FILE);
    const data = content || { threads: [] };

    const thread = data.threads.find((t) => t.id === threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    const reply = {
      id: makeId(),
      body: body.trim(),
      author: walletAddress,
      timestamp: Date.now(),
    };

    thread.replies.push(reply);

    await putFile(
      FILE,
      data,
      sha,
      `discussion: reply by ${walletAddress.slice(0, 8)}… on ${threadId}`
    );

    return NextResponse.json({ ok: true, reply });
  } catch (err) {
    console.error("discussion reply POST error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { threadId, replyId } = await request.json();
    if (!threadId || !replyId) {
      return NextResponse.json({ error: "Missing threadId or replyId." }, { status: 400 });
    }

    const { content, sha } = await getFile(FILE);
    const data = content || { threads: [] };

    const thread = data.threads.find((t) => t.id === threadId);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    thread.replies = thread.replies.filter((r) => r.id !== replyId);

    await putFile(FILE, data, sha, `discussion: admin deleted reply ${replyId}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("discussion reply DELETE error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
