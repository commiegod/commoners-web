import { NextResponse } from "next/server";
import {
  Connection,
  Transaction,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
import { getFile, putFile } from "../../../../lib/githubApi";
import { PROGRAM_ID, RPC_URL, configPDA, proposalPDA } from "../../../../lib/programClient";

const FINALIZE_PROPOSAL_DISCRIMINATOR = Buffer.from([23, 68, 51, 167, 109, 173, 187, 164]);

function u64LeBytes(n) {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(BigInt(n.toString()));
  return buf;
}

function getAdminKeypair() {
  const secret = process.env.ADMIN_KEYPAIR_SECRET;
  if (!secret) throw new Error("ADMIN_KEYPAIR_SECRET not configured");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

// POST { id: string, status: 1 | 2 | 3 }
// status: 1 = passed, 2 = failed, 3 = queued (awaiting execution)
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, status } = await request.json();

    if (![1, 2, 3].includes(status)) {
      return NextResponse.json(
        { error: "status must be 1 (passed), 2 (failed), or 3 (queued)" },
        { status: 400 }
      );
    }

    const { content: proposals, sha } = await getFile("data/proposals.json");
    const proposal = (proposals || []).find((p) => p.id === id);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }
    if (!proposal.chainId) {
      return NextResponse.json(
        { error: "Proposal has no chainId — cannot finalize on-chain." },
        { status: 400 }
      );
    }

    // Build finalize_proposal transaction
    const adminKeypair = getAdminKeypair();
    const [config] = configPDA();
    const chainId = BigInt(proposal.chainId);
    const [proposalPdaKey] = proposalPDA(chainId);

    const data = Buffer.concat([
      FINALIZE_PROPOSAL_DISCRIMINATOR,
      u64LeBytes(chainId),
      Buffer.from([status]),
    ]);

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: config, isSigner: false, isWritable: false },
        { pubkey: proposalPdaKey, isSigner: false, isWritable: true },
      ],
      data,
    });

    const connection = new Connection(RPC_URL, "confirmed");
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({ blockhash, lastValidBlockHeight });
    tx.add(instruction);
    tx.sign(adminKeypair);

    const txSig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight });

    // Update proposals.json
    const statusLabel = status === 1 ? "passed" : status === 2 ? "failed" : "queued";
    const updated = (proposals || []).map((p) =>
      p.id === id
        ? { ...p, status: statusLabel, finalizedAt: new Date().toISOString(), finalizeTxSig: txSig }
        : p
    );
    await putFile(
      "data/proposals.json",
      updated,
      sha,
      `governance: finalize "${proposal.title}" → ${statusLabel}`
    );

    return NextResponse.json({ ok: true, status: statusLabel, txSig });
  } catch (err) {
    console.error("finalize-proposal error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
