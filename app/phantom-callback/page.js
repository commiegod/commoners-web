"use client";

/**
 * /phantom-callback
 *
 * This page receives Phantom's redirect after a deep link request (connect or
 * signMessage). It decrypts the response, stores the result, and immediately
 * navigates the user back to where they came from.
 *
 * URL params set by Phantom on success:
 *   Connect:     ?phantom_encryption_public_key=...&nonce=...&data=...
 *   signMessage: ?action=signMessage&nonce=...&data=...
 *   (+ &return=<encoded-path> that we added in our outbound URL)
 *
 * URL params set by Phantom on rejection/error:
 *   ?errorCode=...&errorMessage=...
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePhantomDeeplink } from "../context/PhantomDeeplinkContext";
import bs58 from "bs58";

// ─── Inner component (needs useSearchParams → must be inside Suspense) ────────

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { handleConnectCallback, handleSignMessageCallback } = usePhantomDeeplink();

  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    const action = searchParams.get("action");
    const returnPath = searchParams.get("return") || "/";
    const errorCode = searchParams.get("errorCode");
    const errorMessage = searchParams.get("errorMessage");

    // ── Error from Phantom ────────────────────────────────────────────────────
    if (errorCode) {
      const msg =
        errorCode === "4001"
          ? "Connection rejected."
          : `Phantom error: ${errorMessage || errorCode}`;
      setStatus(msg);
      // Give the user a moment to read the message, then go back
      setTimeout(() => router.replace(returnPath), 1800);
      return;
    }

    try {
      // ── signMessage callback ────────────────────────────────────────────────
      if (action === "signMessage") {
        const nonce = searchParams.get("nonce");
        const data = searchParams.get("data");

        // Decrypt the signature from Phantom's response
        const signatureBase58 = handleSignMessageCallback({ nonce, data });

        // Convert from base58 to base64 (the server verifies base64 signatures)
        const signatureBytes = new Uint8Array(bs58.decode(signatureBase58));
        const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

        // Store for the originating page to pick up
        sessionStorage.setItem(
          "phantom_sign_result",
          JSON.stringify({ signatureBase64, ts: Date.now() })
        );

        setStatus("Signed! Returning…");

        // Redirect back with a marker so the originating page knows to proceed
        const sep = returnPath.includes("?") ? "&" : "?";
        router.replace(`${returnPath}${sep}deeplink_signed=1`);
      } else {
        // ── Connect callback ──────────────────────────────────────────────────
        const phantom_encryption_public_key = searchParams.get(
          "phantom_encryption_public_key"
        );
        const nonce = searchParams.get("nonce");
        const data = searchParams.get("data");

        handleConnectCallback({ phantom_encryption_public_key, nonce, data });

        setStatus("Connected! Returning…");
        router.replace(returnPath);
      }
    } catch (err) {
      console.error("[phantom-callback] error:", err);
      setStatus("Something went wrong. Returning…");
      setTimeout(() => router.replace(returnPath), 1800);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      {/* Phantom logo placeholder while processing */}
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
