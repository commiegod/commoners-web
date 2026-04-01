"use client";

/**
 * /phantom-callback
 *
 * Receives Phantom's redirect after a deep link request (connect or signMessage).
 * Intentionally does NOT depend on PhantomDeeplinkContext — the context may not
 * be fully mounted during the brief window between page load and the useEffect
 * running, which would cause silent failures. Instead, this page calls the
 * utility functions directly and writes to localStorage. The context reads
 * that localStorage on its own mount useEffect and restores the session.
 *
 * Phantom appends these params on success:
 *   Connect:     ?phantom_encryption_public_key=…&nonce=…&data=…
 *   signMessage: ?action=signMessage&nonce=…&data=…
 *   (+ &return=<encoded-path> that we added in our outbound URL)
 *   Error:       ?errorCode=…&errorMessage=…
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import bs58 from "bs58";

const SS = "phantom_dl_";

// ─── Lightweight session helpers (duplicated here to avoid any import chain) ──

function saveSession({ publicKey, session, boxKey }) {
  localStorage.setItem(SS + "public_key", publicKey);
  localStorage.setItem(SS + "session", session);
  localStorage.setItem(SS + "box_key", JSON.stringify(Array.from(boxKey)));
}

function loadBoxKey() {
  const raw = localStorage.getItem(SS + "box_key");
  return raw ? new Uint8Array(JSON.parse(raw)) : null;
}

// ─── Inner component ──────────────────────────────────────────────────────────

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    const action = searchParams.get("action");
    const returnPath = searchParams.get("return") || "/";
    const errorCode = searchParams.get("errorCode");
    const errorMessage = searchParams.get("errorMessage");

    // ── Phantom returned an error ─────────────────────────────────────────────
    if (errorCode) {
      const msg =
        errorCode === "4001"
          ? "Connection rejected."
          : `Phantom error: ${errorMessage || errorCode}`;
      setStatus(msg);
      setTimeout(() => router.replace(returnPath), 1800);
      return;
    }

    // ── Process the response — import crypto lazily ───────────────────────────
    import("../../lib/phantomDeeplink")
      .then(({ computeBoxKey, decryptPayload }) => {
        if (action === "signMessage") {
          // ── signMessage response ────────────────────────────────────────────
          const nonce = searchParams.get("nonce");
          const data = searchParams.get("data");

          // Load existing box key from localStorage (saved during connect)
          const boxKey = loadBoxKey();
          if (!boxKey) throw new Error("No session box key found — please reconnect");

          const decrypted = decryptPayload(data, nonce, boxKey);

          // Convert Phantom's base58 signature to base64 (server expects base64)
          const signatureBytes = new Uint8Array(bs58.decode(decrypted.signature));
          const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

          localStorage.setItem(
            "phantom_sign_result",
            JSON.stringify({ signatureBase64, ts: Date.now() })
          );

          setStatus("Signed! Returning…");
          const sep = returnPath.includes("?") ? "&" : "?";
          // Full reload so provider remounts and session stays visible
          window.location.href = `${returnPath}${sep}deeplink_signed=1`;
        } else if (action === "signTransaction") {
          // ── signTransaction response: Phantom signed it, we broadcast ─────────
          const nonce = searchParams.get("nonce");
          const data = searchParams.get("data");

          const boxKey = loadBoxKey();
          if (!boxKey) throw new Error("No session box key found — please reconnect");

          const decrypted = decryptPayload(data, nonce, boxKey);
          // decrypted.transaction is a bs58-encoded signed transaction
          const signedTxBytes = new Uint8Array(bs58.decode(decrypted.transaction));

          setStatus("Broadcasting transaction…");

          // Broadcast the signed transaction ourselves
          import("@solana/web3.js").then(({ Connection }) => {
            const rpcUrl =
              process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
              "https://api.mainnet-beta.solana.com";
            const connection = new Connection(rpcUrl, "confirmed");
            return connection.sendRawTransaction(signedTxBytes, {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            });
          }).then((signature) => {
            localStorage.setItem(
              "phantom_tx_result",
              JSON.stringify({ signature, ts: Date.now() })
            );
            setStatus("Transaction sent! Returning…");
            const sep = returnPath.includes("?") ? "&" : "?";
            window.location.href = `${returnPath}${sep}deeplink_tx_sent=1`;
          });

        } else {
          // ── Connect response ────────────────────────────────────────────────
          const phantom_encryption_public_key = searchParams.get(
            "phantom_encryption_public_key"
          );
          const nonce = searchParams.get("nonce");
          const data = searchParams.get("data");

          const boxKey = computeBoxKey(phantom_encryption_public_key);
          const decrypted = decryptPayload(data, nonce, boxKey);
          const { public_key, session } = decrypted;

          // Write session to localStorage — context reads this on mount
          saveSession({ publicKey: public_key, session, boxKey });

          setStatus("Connected! Returning…");
          // Full reload so PhantomDeeplinkProvider remounts and reads localStorage
          window.location.href = returnPath;
        }
      })
      .catch((err) => {
        console.error("[phantom-callback]", err);
        setStatus("Something went wrong. Returning…");
        setTimeout(() => router.replace(returnPath), 1800);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-card border border-border animate-pulse" />
      <p className="text-sm text-muted">{status}</p>
    </div>
  );
}

// ─── Page export (Suspense required for useSearchParams in App Router) ────────

export default function PhantomCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-muted">Connecting…</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
