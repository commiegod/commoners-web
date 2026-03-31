"use client";

/**
 * PhantomDeeplinkContext
 *
 * Manages wallet connection state for mobile users who open the site in Safari
 * or Chrome (where Phantom is not injected as window.solana).
 *
 * The context detects whether deep link mode is needed, exposes connect() and
 * signMessageDeepLink() methods, and restores the session from sessionStorage
 * on every page load (since deep link flows involve full browser navigations).
 *
 * Desktop users and Phantom in-app browser users are completely unaffected —
 * needsDeepLink will be false for them and the standard WalletMultiButton flow
 * continues to work as before.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  buildConnectURL,
  buildSignMessageURL,
  computeBoxKey,
  decryptPayload,
  loadDeeplinkSession,
  saveDeeplinkSession,
  clearDeeplinkSession,
  needsPhantomDeepLink,
} from "../../lib/phantomDeeplink";

// ─── Context ──────────────────────────────────────────────────────────────────

const PhantomDeeplinkContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PhantomDeeplinkProvider({ children }) {
  // null = not yet determined (SSR), false = standard path, true = deep link needed
  const [needsDeepLink, setNeedsDeepLink] = useState(false);

  // Active session — set after a successful connect callback
  // Shape: { publicKey: string, session: string, phantomPublicKey: string, boxKey: Uint8Array }
  const [dlSession, setDlSession] = useState(null);

  // On mount: detect device + restore any existing session from sessionStorage
  useEffect(() => {
    const deepLinkNeeded = needsPhantomDeepLink();
    setNeedsDeepLink(deepLinkNeeded);

    if (deepLinkNeeded) {
      const existing = loadDeeplinkSession();
      if (existing) setDlSession(existing);
    }
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────

  /**
   * Redirect the user to Phantom to approve the wallet connection.
   * @param {string} [returnPath] - path to return to after connect (default: current path)
   */
  const connect = useCallback((returnPath) => {
    const appUrl = window.location.origin;
    const ret = encodeURIComponent(returnPath || window.location.pathname + window.location.search);
    const redirectLink = `${window.location.origin}/phantom-callback?return=${ret}`;
    const url = buildConnectURL({ appUrl, redirectLink });
    window.location.href = url;
  }, []);

  // ── Handle connect callback (called from /phantom-callback page) ───────────

  /**
   * Process the URL params returned by Phantom after a connect request.
   * Decrypts the session, saves it, and updates in-memory state.
   */
  const handleConnectCallback = useCallback(
    ({ phantom_encryption_public_key, nonce, data }) => {
      const boxKey = computeBoxKey(phantom_encryption_public_key);
      const decrypted = decryptPayload(data, nonce, boxKey);
      const { public_key, session } = decrypted;

      const sessionData = {
        publicKey: public_key,
        session,
        phantomPublicKey: phantom_encryption_public_key,
        boxKey,
      };

      saveDeeplinkSession(sessionData);
      setDlSession(sessionData);
      return sessionData;
    },
    []
  );

  // ── signMessage deep link ──────────────────────────────────────────────────

  /**
   * Redirect the user to Phantom to sign a message.
   *
   * Before redirecting, saves `pendingData` to sessionStorage under
   * `phantom_pending_<pendingKey>` so the originating page can retrieve it
   * after Phantom redirects back. Also saves the signedMessage string so the
   * server-side timestamp check works correctly.
   *
   * @param {object} opts
   * @param {Uint8Array}  opts.messageBytes   - raw bytes to sign
   * @param {string}      opts.returnPath     - path to return to after signing
   * @param {string}      opts.pendingKey     - key for sessionStorage (e.g. "bracket")
   * @param {object}      opts.pendingData    - form state to preserve across the redirect
   */
  const signMessageDeepLink = useCallback(
    ({ messageBytes, returnPath, pendingKey, pendingData }) => {
      if (!dlSession) throw new Error("No Phantom deep link session — call connect() first");

      // Persist form state so the originating page can complete the action on return
      if (pendingKey && pendingData) {
        sessionStorage.setItem(
          "phantom_pending_" + pendingKey,
          JSON.stringify(pendingData)
        );
      }

      const ret = encodeURIComponent(returnPath || window.location.pathname + window.location.search);
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

  // ── Handle signMessage callback (called from /phantom-callback page) ───────

  /**
   * Decrypt the signMessage response returned by Phantom.
   * Returns the signature as a base58 string.
   */
  const handleSignMessageCallback = useCallback(
    ({ nonce, data }) => {
      if (!dlSession) {
        // Session might have been restored from sessionStorage before the
        // callback page mounts — try loading it directly
        const restored = loadDeeplinkSession();
        if (!restored) throw new Error("No Phantom deep link session found");

        const decrypted = decryptPayload(data, nonce, restored.boxKey);
        return decrypted.signature; // base58
      }
      const decrypted = decryptPayload(data, nonce, dlSession.boxKey);
      return decrypted.signature; // base58
    },
    [dlSession]
  );

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    clearDeeplinkSession();
    setDlSession(null);
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    needsDeepLink,
    connected: !!dlSession,
    publicKey: dlSession?.publicKey ?? null,    // base58 string
    connect,
    handleConnectCallback,
    signMessageDeepLink,
    handleSignMessageCallback,
    disconnect,
  };

  return (
    <PhantomDeeplinkContext.Provider value={value}>
      {children}
    </PhantomDeeplinkContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePhantomDeeplink() {
  return useContext(PhantomDeeplinkContext);
}
