"use client";

/**
 * PhantomDeeplinkContext
 *
 * Manages wallet connection state for mobile users who open the site in Safari
 * or Chrome (where Phantom is NOT injected as window.solana).
 *
 * Design principles:
 *  - The context is ALWAYS statically imported (no next/dynamic) so it is
 *    immediately available to every component that calls usePhantomDeeplink().
 *  - Lightweight helpers (device detection, localStorage) are inlined here.
 *  - Heavy crypto (@noble/curves, @noble/ciphers) is lazily imported inside
 *    connect() and signMessageDeepLink() — only loaded when actually needed.
 *  - Desktop / Phantom in-app browser users are completely unaffected.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// ─── Inline lightweight helpers (no crypto imports) ───────────────────────────

const SS = "phantom_dl_";

function _isMobileWithoutPhantom() {
  if (typeof window === "undefined") return false;
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) &&
    !window.solana?.isPhantom
  );
}

function _loadSession() {
  try {
    const publicKey = localStorage.getItem(SS + "public_key");
    const session = localStorage.getItem(SS + "session");
    const boxKeyRaw = localStorage.getItem(SS + "box_key");
    if (!publicKey || !session || !boxKeyRaw) return null;
    return {
      publicKey,
      session,
      boxKey: new Uint8Array(JSON.parse(boxKeyRaw)),
    };
  } catch {
    return null;
  }
}

function _saveSession({ publicKey, session, boxKey }) {
  localStorage.setItem(SS + "public_key", publicKey);
  localStorage.setItem(SS + "session", session);
  localStorage.setItem(SS + "box_key", JSON.stringify(Array.from(boxKey)));
}

function _clearSession() {
  ["public_key", "session", "phantom_pubkey", "box_key", "keypair"].forEach(
    (k) => localStorage.removeItem(SS + k)
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PhantomDeeplinkContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PhantomDeeplinkProvider({ children }) {
  const [needsDeepLink, setNeedsDeepLink] = useState(false);
  const [dlSession, setDlSession] = useState(null);

  // Detect device + restore any existing session on mount
  useEffect(() => {
    if (_isMobileWithoutPhantom()) {
      setNeedsDeepLink(true);
      const existing = _loadSession();
      if (existing) setDlSession(existing);
    }
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async (returnPath) => {
    // Lazy-load the heavy crypto only when the user actually taps Connect
    const { buildConnectURL } = await import("../../lib/phantomDeeplink");

    const appUrl = window.location.origin;
    const ret = encodeURIComponent(
      returnPath || window.location.pathname + window.location.search
    );
    const redirectLink = `${window.location.origin}/phantom-callback?return=${ret}`;
    const url = buildConnectURL({ appUrl, redirectLink });
    window.location.href = url;
  }, []);

  // ── signMessage deep link ──────────────────────────────────────────────────

  const signMessageDeepLink = useCallback(
    async ({ messageBytes, returnPath, pendingKey, pendingData }) => {
      if (!dlSession) throw new Error("No deep link session — call connect() first");

      // Save form state before redirecting
      if (pendingKey && pendingData) {
        localStorage.setItem(
          "phantom_pending_" + pendingKey,
          JSON.stringify(pendingData)
        );
      }

      // Lazy-load crypto
      const { buildSignMessageURL } = await import("../../lib/phantomDeeplink");

      const ret = encodeURIComponent(
        returnPath || window.location.pathname + window.location.search
      );
      const redirectLink =
        `${window.location.origin}/phantom-callback` +
        `?action=signMessage&return=${ret}`;

      const url = buildSignMessageURL({
        messageBytes,
        session: dlSession.session,
        boxKey: dlSession.boxKey,
        redirectLink,
      });
      window.location.href = url;
    },
    [dlSession]
  );

  // ── signAndSendTransaction deep link ───────────────────────────────────────

  const signAndSendTransactionDeepLink = useCallback(
    async ({ serializedTx, returnPath }) => {
      if (!dlSession) throw new Error("No deep link session — call connect() first");
      const { buildSignAndSendTransactionURL } = await import("../../lib/phantomDeeplink");
      const ret = encodeURIComponent(returnPath || window.location.pathname);
      const redirectLink =
        `${window.location.origin}/phantom-callback` +
        `?action=signAndSendTransaction&return=${ret}`;
      const url = buildSignAndSendTransactionURL({
        serializedTx,
        session: dlSession.session,
        boxKey: dlSession.boxKey,
        redirectLink,
      });
      window.location.href = url;
    },
    [dlSession]
  );

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    _clearSession();
    setDlSession(null);
  }, []);

  // ── Expose a way for the callback page to notify the context of a new session
  // (called after the callback page writes to localStorage)
  const refreshSession = useCallback(() => {
    const session = _loadSession();
    if (session) setDlSession(session);
  }, []);

  return (
    <PhantomDeeplinkContext.Provider
      value={{
        needsDeepLink,
        connected: !!dlSession,
        publicKey: dlSession?.publicKey ?? null,
        connect,
        signMessageDeepLink,
        signAndSendTransactionDeepLink,
        disconnect,
        refreshSession,
      }}
    >
      {children}
    </PhantomDeeplinkContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePhantomDeeplink() {
  return useContext(PhantomDeeplinkContext);
}
