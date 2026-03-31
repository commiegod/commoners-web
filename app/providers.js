"use client";

import { Buffer } from "buffer";
import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_URL } from "../lib/programClient";
import dynamic from "next/dynamic";

// Load the deep link provider as a client-only chunk so the heavy @noble crypto
// libraries are never included in the server bundle or initial page payload.
// Desktop users and Phantom in-app browser users pay zero cost for this.
const PhantomDeeplinkProvider = dynamic(
  () =>
    import("./context/PhantomDeeplinkContext").then(
      (m) => m.PhantomDeeplinkProvider
    ),
  { ssr: false, loading: () => null }
);

import "@solana/wallet-adapter-react-ui/styles.css";

// Polyfill Buffer globally for Solana libraries that need it
if (typeof globalThis !== "undefined") {
  globalThis.Buffer = globalThis.Buffer || Buffer;
}

export function Providers({ children }) {
  // Empty array: Phantom, Solflare and other Wallet Standard wallets are
  // auto-detected by WalletProvider. Explicitly registering them triggers
  // deprecation warnings in @solana/wallet-adapter-wallets >= 0.19.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {/* PhantomDeeplinkProvider handles mobile Safari/Chrome users who
              open the site outside of Phantom's in-app browser. It is a no-op
              for desktop users and Phantom in-app browser users. */}
          <PhantomDeeplinkProvider>
            {children}
          </PhantomDeeplinkProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
