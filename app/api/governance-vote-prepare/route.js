import { NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { getCommonerCount } from "../../../lib/serverChecks";
import {
  PROGRAM_ID,
  RPC_URL,
  configPDA,
  proposalPDA,
  voteRecordPDA,
} from "../../../lib/programClient";

// cast_vote instruction discriminator (from IDL)
const CAST_VOTE_DISCRIMINATOR = Buffer.from([20, 212, 15, 189, 69, 180, 69, 151]);

function u64LeBytes(n) {
  const buf = Buffer.allocUnsafe(8);
  const big = BigInt(n.toString());
  buf.writeBigUInt64LE(big);
  return buf;
}

function getAdminKeypair() {
  const secret = process.env.ADMIN_KEYPAIR_SECRET;
  if (!secret) throw new Error("ADMIN_KEYPAIR_SECRET not configured");
  const arr = JSON.parse(secret);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export async function POST(request) {
  try {
    const { proposalId, walletAddress, yes = 0, no = 0, abstain = 0 } =
      await request.json();

    if (!proposalId || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const totalAllocated = (yes || 0) + (no || 0) + (abstain || 0);
    if (totalAllocated === 0) {
      return NextResponse.json({ error: "Allocate at least 1 vote." }, { status: 400 });
    }

    // Verify NFT holdings on-chain (mainnet via Helius DAS)
    const weight = await getCommonerCount(walletAddress);
    if (weight === 0) {
      return NextResponse.json(
        { error: "You must hold a Commoner NFT to vote." },
        { status: 403 }
      );
    }
    if (totalAllocated > weight) {
      return NextResponse.json(
        { error: `Cannot allocate more than your ${weight} votes.` },
        { status: 400 }
      );
    }

    const adminKeypair = getAdminKeypair();
    const voter = new PublicKey(walletAddress);
    const propIdBig = BigInt(proposalId.toString());

    const [config] = configPDA();
    const [proposal] = proposalPDA(propIdBig);
    const [voteRecord] = voteRecordPDA(propIdBig, voter);

    // Borsh-encode instruction data: discriminator + args (proposal_id, weight, yes, no, abstain)
    const data = Buffer.concat([
      CAST_VOTE_DISCRIMINATOR,
      u64LeBytes(propIdBig),
      u64LeBytes(weight),
      u64LeBytes(yes || 0),
      u64LeBytes(no || 0),
      u64LeBytes(abstain || 0),
    ]);

    const instruction = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: voter, isSigner: true, isWritable: true },
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: config, isSigner: false, isWritable: false },
        { pubkey: proposal, isSigner: false, isWritable: true },
        { pubkey: voteRecord, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    const connection = new Connection(RPC_URL, "confirmed");
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction({
      feePayer: voter,
      blockhash,
      lastValidBlockHeight,
    });
    tx.add(instruction);

    // Admin co-signs (proves NFT holdings were verified)
    tx.partialSign(adminKeypair);

    // Serialize with voter signature slot still empty — frontend fills it
    const serialized = tx.serialize({ requireAllSignatures: false });

    return NextResponse.json({
      ok: true,
      transaction: serialized.toString("base64"),
      weight,
      blockhash,
      lastValidBlockHeight,
    });
  } catch (err) {
    console.error("governance-vote-prepare error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
