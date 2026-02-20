"use client";

import { useState, useEffect } from "react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import commoners from "../../data/commoners.json";
import idl from "../../lib/idl.json";
import { PROGRAM_ID, configPDA, slotPDA } from "../../lib/programClient";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const COMMONER_MINTS = new Set(commoners.nfts.map((n) => n.id));
const COMMONER_BY_MINT = Object.fromEntries(
  commoners.nfts.map((n) => [n.id, n])
);

function getAta(owner, mint) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

function getAvailableDates(takenDates) {
  const taken = new Set(takenDates);
  const dates = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  // Start from tomorrow
  for (let i = 1; i <= 60; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const str = d.toISOString().split("T")[0];
    if (!taken.has(str)) {
      dates.push({ str, ts: Math.floor(d.getTime() / 1000) });
    }
  }
  return dates;
}

export default function ListSlotModal({ takenDates, onClose, onSuccess }) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [step, setStep] = useState("loading"); // loading | pick | submitting | done
  const [myNfts, setMyNfts] = useState([]);
  const [selectedMint, setSelectedMint] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [reserveSol, setReserveSol] = useState("0.1");
  const [txError, setTxError] = useState(null);

  const availableDates = getAvailableDates(takenDates);

  useEffect(() => {
    if (!wallet.publicKey) {
      setStep("pick");
      return;
    }
    scanWallet();
  }, [wallet.publicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function scanWallet() {
    setStep("loading");
    try {
      const { value: tokenAccounts } =
        await connection.getTokenAccountsByOwner(wallet.publicKey, {
          programId: TOKEN_PROGRAM_ID,
        });

      const ownedMints = [];
      for (const { account } of tokenAccounts) {
        const mint = new PublicKey(account.data.slice(0, 32)).toBase58();
        const amount = new BN(account.data.slice(64, 72), "le");
        if (amount.eqn(1) && COMMONER_MINTS.has(mint)) {
          ownedMints.push(mint);
        }
      }

      setMyNfts(ownedMints.map((m) => COMMONER_BY_MINT[m]));
    } catch (e) {
      console.error("Wallet scan failed:", e);
      setMyNfts([]);
    } finally {
      setStep("pick");
    }
  }

  async function submit() {
    if (!wallet.publicKey || !selectedMint || !selectedDate) return;
    setTxError(null);
    setStep("submitting");

    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      const program = new Program(idl, provider);

      const mintPubkey = new PublicKey(selectedMint);
      const scheduledDateBn = new BN(selectedDate.ts);
      const reserveLamports = new BN(
        Math.round(parseFloat(reserveSol) * LAMPORTS_PER_SOL)
      );

      const [config] = configPDA();
      const [slot] = slotPDA(mintPubkey, scheduledDateBn);
      const holderTokenAccount = getAta(wallet.publicKey, mintPubkey);
      const escrowTokenAccount = getAta(slot, mintPubkey);

      await program.methods
        .listSlot(scheduledDateBn, reserveLamports)
        .accounts({
          holder: wallet.publicKey,
          config,
          nftMint: mintPubkey,
          holderTokenAccount,
          escrowTokenAccount,
          slot,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setStep("done");
      setTimeout(onSuccess, 1500);
    } catch (e) {
      const msg =
        e?.message?.match(/custom program error: (0x\w+)/)?.[0] ||
        e?.message ||
        "Transaction failed";
      setTxError(msg);
      setStep("pick");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-blackletter text-xl text-gold">List Your NFT</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        {!wallet.publicKey ? (
          <div className="text-center space-y-4 py-4">
            <p className="text-muted text-sm">
              Connect your wallet to list an NFT.
            </p>
            <WalletMultiButton
              style={{
                backgroundColor: "#d4a843",
                color: "#09090b",
                borderRadius: 0,
                fontSize: "0.875rem",
              }}
            />
          </div>
        ) : step === "loading" ? (
          <p className="text-muted text-sm text-center py-8">
            Scanning wallet…
          </p>
        ) : step === "done" ? (
          <p className="text-green-400 text-sm text-center py-8">
            Slot registered! Refreshing schedule…
          </p>
        ) : (
          <div className="space-y-5">
            {/* NFT selection */}
            <div>
              <label className="text-xs text-muted tracking-widest block mb-2">
                SELECT YOUR COMMONER
              </label>
              {myNfts.length === 0 ? (
                <p className="text-sm text-muted">
                  No MidEvil Commoners found in this wallet.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {myNfts.map((nft) => (
                    <button
                      key={nft.id}
                      onClick={() => setSelectedMint(nft.id)}
                      className={`border text-left overflow-hidden transition-colors ${
                        selectedMint === nft.id
                          ? "border-gold"
                          : "border-border"
                      }`}
                    >
                      <img
                        src={nft.image}
                        alt={nft.name}
                        className="w-full aspect-square object-cover"
                      />
                      <p className="text-xs p-1 truncate">{nft.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date selection */}
            <div>
              <label className="text-xs text-muted tracking-widest block mb-2">
                AUCTION DATE
              </label>
              <select
                value={selectedDate?.str || ""}
                onChange={(e) => {
                  const d = availableDates.find(
                    (d) => d.str === e.target.value
                  );
                  setSelectedDate(d || null);
                }}
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
              >
                <option value="">— Select a date —</option>
                {availableDates.map((d) => (
                  <option key={d.str} value={d.str}>
                    {d.str}
                  </option>
                ))}
              </select>
            </div>

            {/* Reserve price */}
            <div>
              <label className="text-xs text-muted tracking-widest block mb-2">
                RESERVE PRICE (SOL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={reserveSol}
                  onChange={(e) => setReserveSol(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-gold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                  SOL
                </span>
              </div>
            </div>

            {txError && <p className="text-xs text-red-400">{txError}</p>}

            <button
              onClick={submit}
              disabled={!selectedMint || !selectedDate || step === "submitting"}
              className="w-full py-2 bg-gold text-background text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {step === "submitting" ? "Submitting…" : "Register Slot"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
