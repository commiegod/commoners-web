import { NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { getFile, putFile } from "../../../../lib/githubApi";
import { PROGRAM_ID, RPC_URL, configPDA, proposalPDA } from "../../../../lib/programClient";

// create_proposal instruction discriminator (from IDL)
const CREATE_PROPOSAL_DISCRIMINATOR = Buffer.from([132, 116, 68, 174, 216, 160, 198, 22]);

function u64LeBytes(n) {
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(BigInt(n.toString()));
  return buf;
}

function borshString(s) {
  const encoded = Buffer.from(s, "utf8");
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32LE(encoded.length);
  return Buffer.concat([len, encoded]);
}

function getAdminKeypair() {
  const secret = process.env.ADMIN_KEYPAIR_SECRET;
  if (!secret) throw new Error("ADMIN_KEYPAIR_SECRET not configured");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    const { content: pending, sha: pendingSha } = await getFile(
      "data/pending-proposals.json"
    );
    const submission = (pending || []).find((p) => p.id === id);
    if (!submission) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    // Use millisecond timestamp as on-chain proposal ID
    const chainId = BigInt(Date.now());
    const durationSecs = BigInt(72 * 60 * 60); // 72 hours

    // ── Create on-chain proposal ──────────────────────────────────────────────
    const adminKeypair = getAdminKeypair();
    const [config] = configPDA();
    const [proposal] = proposalPDA(chainId);

    const proposerPubkey = (() => {
      try { return new PublicKey(submission.proposedBy); }
      catch { return adminKeypair.publicKey; }
    })();

    const title = submission.title.slice(0, 100);
    const description = submission.description.slice(0, 800);
    const proposalType = (submission.type || "community-initiative").slice(0, 50);
    const treasurySol = BigInt(
      Math.round((submission.treasurySol || 0) * 1_000_000_000)
    );

    // Borsh encode create_proposal args:
    // proposal_id: u64, proposer: Pubkey, title: String, description: String,
    // proposal_type: String, treasury_sol: u64, duration_secs: i64
    const data = Buffer.concat([
      CREATE_PROPOSAL_DISCRIMINATOR,
      u64LeBytes(chainId),
      proposerPubkey.toBuffer(),
      borshString(title),
      borshString(description),
      borshString(proposalType),
      u64LeBytes(treasurySol),
      u64LeBytes(durationSecs),
    ]);

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: config, isSigner: false, isWritable: false },
        { pubkey: proposal, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
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

    // ── Save to proposals.json ────────────────────────────────────────────────
    const endsAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const activeProposal = {
      id: submission.id,
      chainId: chainId.toString(), // on-chain PDA key
      type: submission.type,
      title: submission.title,
      description: submission.description,
      treasurySol: submission.treasurySol || 0,
      proposedBy: submission.proposedBy,
      status: "active",
      endsAt,
      votes: { yes: 0, no: 0, abstain: 0 },
      txSig,
    };

    const { content: proposals, sha: proposalsSha } = await getFile("data/proposals.json");
    await putFile(
      "data/proposals.json",
      [...(proposals || []), activeProposal],
      proposalsSha,
      `governance: approve proposal "${submission.title}" (chain: ${chainId})`
    );

    // Remove from pending
    const updatedPending = (pending || []).filter((p) => p.id !== id);
    await putFile(
      "data/pending-proposals.json",
      updatedPending,
      pendingSha,
      `governance: clear approved proposal ${id}`
    );

    return NextResponse.json({ ok: true, chainId: chainId.toString(), txSig });
  } catch (err) {
    console.error("approve-proposal error:", err);
    return NextResponse.json({ error: err.message || "Internal server error." }, { status: 500 });
  }
}
